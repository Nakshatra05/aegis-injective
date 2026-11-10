use super::*;
use cosmwasm_std::testing::{message_info, mock_dependencies, mock_env};
use cosmwasm_std::{coins, from_json, SubMsgResponse, SubMsgResult};
fn policy() -> Policy {
    Policy {
        id: 1,
        agent: Addr::unchecked("agent"),
        per_order: Uint128::new(10_000_000),
        cap: Uint128::new(50_000_000),
        spent: Uint128::zero(),
        expires_at: 2000,
        revoked: false,
        max_price: Uint128::new(20_000_000),
        next_nonce: 0,
    }
}
fn check(
    p: &Policy,
    caller: &str,
    now: u64,
    id: u64,
    nonce: u64,
    market: &str,
    direction: &str,
    budget: u128,
    price: u128,
) -> StdResult<()> {
    validate(
        p,
        &Addr::unchecked(caller),
        now,
        id,
        nonce,
        market,
        direction,
        Uint128::new(budget),
        Uint128::new(price),
    )
}
#[test]
fn allowed_and_exact_boundary() {
    assert!(check(
        &policy(),
        "agent",
        1999,
        1,
        0,
        MARKET,
        "buy",
        10_000_000,
        20_000_000
    )
    .is_ok());
}
#[test]
fn unauthorized_caller() {
    assert!(
        check(&policy(), "attacker", 1000, 1, 0, MARKET, "buy", 1, 1000)
            .unwrap_err()
            .to_string()
            .contains("Unauthorized")
    );
}
#[test]
fn disallowed_market_and_direction() {
    for (m, d) in [("bad", "buy"), (MARKET, "sell")] {
        assert!(check(&policy(), "agent", 1000, 1, 0, m, d, 1, 1000).is_err());
    }
}
#[test]
fn oversized_and_zero_orders() {
    for n in [0, 10_000_001, u128::MAX] {
        assert!(check(&policy(), "agent", 1000, 1, 0, MARKET, "buy", n, 1000).is_err());
    }
}
#[test]
fn cumulative_boundary() {
    let mut p = policy();
    p.spent = Uint128::new(49_999_999);
    assert!(check(&p, "agent", 1000, 1, 0, MARKET, "buy", 1, 1000).is_ok());
    assert!(check(&p, "agent", 1000, 1, 0, MARKET, "buy", 2, 1000).is_err());
}
#[test]
fn expired_at_exact_chain_time() {
    assert!(check(&policy(), "agent", 2000, 1, 0, MARKET, "buy", 1, 1000).is_err());
}
#[test]
fn revoked() {
    let mut p = policy();
    p.revoked = true;
    assert!(check(&p, "agent", 1000, 1, 0, MARKET, "buy", 1, 1000).is_err());
}
#[test]
fn replay_and_wrong_policy() {
    assert!(check(&policy(), "agent", 1000, 1, 1, MARKET, "buy", 1, 1000).is_err());
    assert!(check(&policy(), "agent", 1000, 2, 0, MARKET, "buy", 1, 1000).is_err());
}
#[test]
fn decimal_tick_and_price_ceiling() {
    for n in [0, 1001, 20_001_000] {
        assert!(check(&policy(), "agent", 1000, 1, 0, MARKET, "buy", 1, n).is_err());
    }
}
#[test]
fn withdrawal_is_owner_only_and_never_resets_spend() {
    let mut d = mock_dependencies();
    let mut e = mock_env();
    e.block.chain_id = CHAIN.into();
    let o = d.api.addr_make("owner");
    let a = d.api.addr_make("attacker");
    OWNER.save(d.as_mut().storage, &o).unwrap();
    let mut p = policy();
    p.spent = Uint128::new(12);
    POLICY.save(d.as_mut().storage, &p).unwrap();
    let msg = ExecuteMsg::Withdraw {
        denom: QUOTE.into(),
        amount: Uint128::new(1),
    };
    assert!(execute(d.as_mut(), e.clone(), message_info(&a, &[]), msg.clone()).is_err());
    let res = execute(d.as_mut(), e, message_info(&o, &[]), msg).unwrap();
    assert_eq!(res.messages.len(), 1);
    assert_eq!(
        POLICY.load(d.as_ref().storage).unwrap().spent,
        Uint128::new(12)
    );
}
#[test]
fn successful_reply_reserves_full_budget_and_increments_nonce() {
    let mut d = mock_dependencies();
    let e = mock_env();
    POLICY.save(d.as_mut().storage, &policy()).unwrap();
    PENDING
        .save(
            d.as_mut().storage,
            &Pending {
                budget: Uint128::new(5_000_000),
                quote_before: Uint128::new(10_000_000),
                base_before: Uint128::zero(),
                policy_id: 1,
                nonce: 0,
            },
        )
        .unwrap();
    d.querier.bank.update_balance(
        &e.contract.address,
        vec![Coin::new(6_000_000u128, QUOTE), Coin::new(LOT, "inj")],
    );
    #[allow(deprecated)]
    let msg = Reply {
        id: 1,
        payload: Binary::default(),
        gas_used: 0,
        result: SubMsgResult::Ok(SubMsgResponse {
            events: vec![],
            data: None,
            msg_responses: vec![],
        }),
    };
    reply(d.as_mut(), e, msg).unwrap();
    let p = POLICY.load(d.as_ref().storage).unwrap();
    assert_eq!(p.spent.u128(), 5_000_000);
    assert_eq!(p.next_nonce, 1);
    assert!(PENDING.may_load(d.as_ref().storage).unwrap().is_none());
}
#[test]
fn failed_or_unfilled_reply_never_accounts() {
    for balance in [0u128, 10_000_000] {
        let mut d = mock_dependencies();
        let e = mock_env();
        POLICY.save(d.as_mut().storage, &policy()).unwrap();
        PENDING
            .save(
                d.as_mut().storage,
                &Pending {
                    budget: Uint128::new(5_000_000),
                    quote_before: Uint128::new(10_000_000),
                    base_before: Uint128::zero(),
                    policy_id: 1,
                    nonce: 0,
                },
            )
            .unwrap();
        d.querier
            .bank
            .update_balance(&e.contract.address, coins(balance, QUOTE));
        #[allow(deprecated)]
        let msg = Reply {
            id: 1,
            payload: Binary::default(),
            gas_used: 0,
            result: SubMsgResult::Ok(SubMsgResponse {
                events: vec![],
                data: None,
                msg_responses: vec![],
            }),
        };
        assert!(reply(d.as_mut(), e, msg).is_err());
        assert_eq!(
            POLICY.load(d.as_ref().storage).unwrap().spent,
            Uint128::zero()
        );
    }
}
#[test]
fn policy_immutability_and_explicit_replacement() {
    let mut d = mock_dependencies();
    let mut e = mock_env();
    e.block.chain_id = CHAIN.into();
    e.block.time = cosmwasm_std::Timestamp::from_seconds(1000);
    let o = d.api.addr_make("owner");
    let a = d.api.addr_make("agent");
    instantiate(
        d.as_mut(),
        e.clone(),
        message_info(&o, &[]),
        InstantiateMsg {},
    )
    .unwrap();
    let m = ExecuteMsg::CreatePolicy {
        agent: a.to_string(),
        per_order: Uint128::new(10),
        cap: Uint128::new(50),
        expires_at: 2000,
        max_price: Uint128::new(1000),
    };
    execute(d.as_mut(), e.clone(), message_info(&o, &[]), m.clone()).unwrap();
    assert!(execute(d.as_mut(), e.clone(), message_info(&o, &[]), m.clone()).is_err());
    execute(
        d.as_mut(),
        e.clone(),
        message_info(&o, &[]),
        ExecuteMsg::Revoke { policy_id: 1 },
    )
    .unwrap();
    execute(d.as_mut(), e.clone(), message_info(&o, &[]), m).unwrap();
    let s: State = from_json(query(d.as_ref(), e, QueryMsg::State {}).unwrap()).unwrap();
    assert_eq!(s.policy.unwrap().id, 2);
}
#[test]
fn testnet_only() {
    let mut d = mock_dependencies();
    let e = mock_env();
    let o = d.api.addr_make("owner");
    assert!(instantiate(d.as_mut(), e, message_info(&o, &[]), InstantiateMsg {}).is_err());
}

// Transaction-level tests use a simulated exchange module, not a real matcher.
// They exercise CosmWasm submessage/reply rollback and protobuf wire values.
mod transaction_tests {
    use super::*;
    use cosmwasm_std::{Api, BlockInfo, CustomMsg, CustomQuery, Storage};
    use cw_multi_test::{
        AddressGenerator, AppBuilder, AppResponse, ContractWrapper, CosmosRouter, Executor,
        Stargate, WasmKeeper,
    };
    use serde::de::DeserializeOwned;
    struct InjectiveAddress;
    impl AddressGenerator for InjectiveAddress {
        fn contract_address(
            &self,
            _: &dyn Api,
            _: &mut dyn Storage,
            _: u64,
            _: u64,
        ) -> anyhow::Result<Addr> {
            Ok(Addr::unchecked(
                "inj1khsfhyavadcvzug67pufytaz2cq36ljkrsr0nv",
            ))
        }
    }
    struct Exchange {
        fail: bool,
        overcharge: bool,
        no_fill: bool,
        exchange: Addr,
    }
    impl Stargate for Exchange {
        fn execute_any<E, Q>(
            &self,
            api: &dyn Api,
            storage: &mut dyn Storage,
            router: &dyn CosmosRouter<ExecC = E, QueryC = Q>,
            block: &BlockInfo,
            sender: Addr,
            msg: AnyMsg,
        ) -> anyhow::Result<AppResponse>
        where
            E: CustomMsg + DeserializeOwned + 'static,
            Q: CustomQuery + DeserializeOwned + 'static,
        {
            anyhow::ensure!(
                msg.type_url == "/injective.exchange.v1beta1.MsgCreateSpotMarketOrder",
                "wrong message"
            );
            let decoded = SpotMarketOrder::decode(msg.value.as_slice())?;
            let order = decoded.order.unwrap();
            let info = order.order_info.unwrap();
            assert_eq!(order.order_type, 9);
            assert_eq!(order.market_id, MARKET);
            assert_eq!(decoded.sender, sender.as_str());
            assert_eq!(info.price, "10000000");
            assert_eq!(info.quantity, "495000000000000000000000000000000000");
            if self.fail {
                anyhow::bail!("Simulated exchange failure");
            }
            if self.no_fill {
                return Ok(AppResponse::default());
            }
            router.execute(
                api,
                storage,
                block,
                sender.clone(),
                BankMsg::Send {
                    to_address: self.exchange.to_string(),
                    amount: coins(
                        if self.overcharge {
                            6_000_000
                        } else {
                            4_000_000
                        },
                        QUOTE,
                    ),
                }
                .into(),
            )?;
            router.execute(
                api,
                storage,
                block,
                self.exchange.clone(),
                BankMsg::Send {
                    to_address: sender.to_string(),
                    amount: coins(495_000_000_000_000_000, "inj"),
                }
                .into(),
            )?;
            Ok(AppResponse::default())
        }
    }
    fn scenario(fail: bool, overcharge: bool, no_fill: bool) {
        let api = cosmwasm_std::testing::MockApi::default().with_prefix("inj");
        let owner = api.addr_make("owner");
        let agent = api.addr_make("agent");
        let exchange = api.addr_make("exchange");
        let mut app = AppBuilder::new()
            .with_api(api)
            .with_wasm(WasmKeeper::new().with_address_generator(InjectiveAddress))
            .with_stargate(Exchange {
                fail,
                overcharge,
                no_fill,
                exchange: exchange.clone(),
            })
            .build(|router, _, storage| {
                router
                    .bank
                    .init_balance(storage, &owner, coins(20_000_000, QUOTE))
                    .unwrap();
                router
                    .bank
                    .init_balance(storage, &exchange, coins(10_000_000_000_000_000_000, "inj"))
                    .unwrap();
            });
        app.update_block(|b| {
            b.chain_id = CHAIN.into();
            b.time = cosmwasm_std::Timestamp::from_seconds(1000);
        });
        let code = app.store_code(Box::new(
            ContractWrapper::new(execute, instantiate, query).with_reply(reply),
        ));
        let vault = app
            .instantiate_contract(code, owner.clone(), &InstantiateMsg {}, &[], "aegis", None)
            .unwrap();
        app.execute_contract(
            owner.clone(),
            vault.clone(),
            &ExecuteMsg::CreatePolicy {
                agent: agent.to_string(),
                per_order: Uint128::new(10_000_000),
                cap: Uint128::new(50_000_000),
                expires_at: 2000,
                max_price: Uint128::new(20_000_000),
            },
            &[],
        )
        .unwrap();
        app.execute_contract(
            owner.clone(),
            vault.clone(),
            &ExecuteMsg::Deposit {},
            &coins(10_000_000, QUOTE),
        )
        .unwrap();
        let buy = ExecuteMsg::Buy {
            policy_id: 1,
            nonce: 0,
            market: MARKET.into(),
            direction: "buy".into(),
            quote_budget: Uint128::new(5_000_000),
            limit_price: Uint128::new(10_000_000),
        };
        let result = app.execute_contract(agent.clone(), vault.clone(), &buy, &[]);
        let state: State = app
            .wrap()
            .query_wasm_smart(&vault, &QueryMsg::State {})
            .unwrap();
        let p = state.policy.unwrap();
        if fail || overcharge || no_fill {
            assert!(result.is_err());
            assert_eq!(p.spent.u128(), 0);
            assert_eq!(p.next_nonce, 0);
            assert_eq!(
                app.wrap()
                    .query_balance(&vault, QUOTE)
                    .unwrap()
                    .amount
                    .u128(),
                10_000_000
            );
            assert_eq!(
                app.wrap()
                    .query_balance(&vault, "inj")
                    .unwrap()
                    .amount
                    .u128(),
                0
            );
        } else {
            result.unwrap();
            assert_eq!(p.spent.u128(), 5_000_000);
            assert_eq!(p.next_nonce, 1);
            assert!(app
                .execute_contract(agent, vault.clone(), &buy, &[])
                .is_err());
            app.execute_contract(
                owner.clone(),
                vault.clone(),
                &ExecuteMsg::Withdraw {
                    denom: "inj".into(),
                    amount: Uint128::new(495_000_000_000_000_000),
                },
                &[],
            )
            .unwrap();
            assert_eq!(
                app.wrap()
                    .query_balance(&owner, "inj")
                    .unwrap()
                    .amount
                    .u128(),
                495_000_000_000_000_000
            );
        }
    }
    #[test]
    fn atomic_success_and_owner_withdrawal() {
        scenario(false, false, false);
    }
    #[test]
    fn exchange_failure_rolls_back_everything() {
        scenario(true, false, false);
    }
    #[test]
    fn excess_debit_in_reply_rolls_back_exchange_and_policy() {
        scenario(false, true, false);
    }
    #[test]
    fn zero_fill_rolls_back() {
        scenario(false, false, true);
    }
}
