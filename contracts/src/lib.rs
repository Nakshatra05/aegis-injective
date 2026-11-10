use bech32::FromBase32;
use cosmwasm_std::{
    entry_point, to_json_binary, Addr, AnyMsg, BankMsg, Binary, Coin, CosmosMsg, Deps, DepsMut,
    Env, MessageInfo, Reply, Response, StdError, StdResult, SubMsg, Uint128, Uint256,
};
use cw_storage_plus::Item;
use prost::Message;
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};

pub const CHAIN: &str = "injective-888";
pub const MARKET: &str = "0x0611780ba69656949525013d947713300f56c37b6175e02f26bffa495c3208fe";
pub const QUOTE: &str = "peggy0x87aB3B4C8661e07D6372361211B96ed4Dc36B1B5";
pub const LOT: u128 = 1_000_000_000_000_000;
const OWNER: Item<Addr> = Item::new("owner");
const POLICY: Item<Policy> = Item::new("policy");
const PENDING: Item<Pending> = Item::new("pending");

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct InstantiateMsg {}
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
#[serde(rename_all = "snake_case", deny_unknown_fields)]
pub enum ExecuteMsg {
    CreatePolicy {
        agent: String,
        per_order: Uint128,
        cap: Uint128,
        expires_at: u64,
        max_price: Uint128,
    },
    Revoke {
        policy_id: u64,
    },
    Deposit {},
    Withdraw {
        denom: String,
        amount: Uint128,
    },
    Buy {
        policy_id: u64,
        nonce: u64,
        market: String,
        direction: String,
        quote_budget: Uint128,
        limit_price: Uint128,
    },
}
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
#[serde(rename_all = "snake_case")]
pub enum QueryMsg {
    State {},
}
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
pub struct Policy {
    pub id: u64,
    pub agent: Addr,
    pub per_order: Uint128,
    pub cap: Uint128,
    pub spent: Uint128,
    pub expires_at: u64,
    pub revoked: bool,
    pub max_price: Uint128,
    pub next_nonce: u64,
}
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
pub struct State {
    pub owner: Addr,
    pub policy: Option<Policy>,
    pub chain: String,
    pub market: String,
}
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
struct Pending {
    budget: Uint128,
    quote_before: Uint128,
    base_before: Uint128,
    policy_id: u64,
    nonce: u64,
}
fn fail(msg: &str) -> StdError {
    StdError::generic_err(msg)
}
fn owner(deps: Deps, info: &MessageInfo) -> StdResult<()> {
    if OWNER.load(deps.storage)? != info.sender {
        return Err(fail("Unauthorized owner"));
    }
    Ok(())
}
fn chain(env: &Env) -> StdResult<()> {
    if env.block.chain_id != CHAIN {
        return Err(fail("Testnet only"));
    }
    Ok(())
}

#[entry_point]
pub fn instantiate(
    deps: DepsMut,
    env: Env,
    info: MessageInfo,
    _: InstantiateMsg,
) -> StdResult<Response> {
    chain(&env)?;
    if !info.funds.is_empty() {
        return Err(fail("Instantiate without funds"));
    }
    OWNER.save(deps.storage, &info.sender)?;
    Ok(Response::new()
        .add_attribute("action", "instantiate")
        .add_attribute("owner", info.sender))
}

#[entry_point]
pub fn execute(deps: DepsMut, env: Env, info: MessageInfo, msg: ExecuteMsg) -> StdResult<Response> {
    chain(&env)?;
    if PENDING.may_load(deps.storage)?.is_some() {
        return Err(fail("Execution in progress"));
    }
    if !matches!(msg, ExecuteMsg::Deposit {}) && !info.funds.is_empty() {
        return Err(fail("Unexpected funds"));
    }
    match msg {
        ExecuteMsg::CreatePolicy {
            agent,
            per_order,
            cap,
            expires_at,
            max_price,
        } => {
            owner(deps.as_ref(), &info)?;
            let prior = POLICY.may_load(deps.storage)?;
            if prior
                .as_ref()
                .is_some_and(|p| !p.revoked && env.block.time.seconds() < p.expires_at)
            {
                return Err(fail("Policy immutable: revoke first"));
            }
            if per_order.is_zero()
                || cap < per_order
                || max_price.is_zero()
                || max_price.u128() % 1000 != 0
                || expires_at <= env.block.time.seconds()
            {
                return Err(fail("Invalid policy limits, tick or expiry"));
            }
            let p = Policy {
                id: prior.map_or(Ok(1), |p| {
                    p.id.checked_add(1).ok_or_else(|| fail("Policy overflow"))
                })?,
                agent: deps.api.addr_validate(&agent)?,
                per_order,
                cap,
                spent: Uint128::zero(),
                expires_at,
                revoked: false,
                max_price,
                next_nonce: 0,
            };
            if p.agent == env.contract.address || p.agent == info.sender {
                return Err(fail("Use a distinct agent"));
            }
            POLICY.save(deps.storage, &p)?;
            Ok(Response::new()
                .add_attribute("action", "create_policy")
                .add_attribute("policy_id", p.id.to_string()))
        }
        ExecuteMsg::Revoke { policy_id } => {
            owner(deps.as_ref(), &info)?;
            POLICY.update(deps.storage, |mut p| -> StdResult<_> {
                if p.id != policy_id {
                    return Err(fail("Wrong policy"));
                }
                p.revoked = true;
                Ok(p)
            })?;
            Ok(Response::new()
                .add_attribute("action", "revoke")
                .add_attribute("policy_id", policy_id.to_string()))
        }
        ExecuteMsg::Deposit {} => {
            owner(deps.as_ref(), &info)?;
            if info.funds.is_empty()
                || info
                    .funds
                    .iter()
                    .any(|c| c.denom != QUOTE && c.denom != "inj")
            {
                return Err(fail("Only INJ and USDT deposits"));
            }
            Ok(Response::new().add_attribute("action", "deposit"))
        }
        ExecuteMsg::Withdraw { denom, amount } => {
            owner(deps.as_ref(), &info)?;
            if amount.is_zero() || (denom != QUOTE && denom != "inj") {
                return Err(fail("Invalid withdrawal"));
            }
            Ok(Response::new()
                .add_message(BankMsg::Send {
                    to_address: info.sender.into_string(),
                    amount: vec![Coin::new(amount.u128(), denom)],
                })
                .add_attribute("action", "withdraw"))
        }
        ExecuteMsg::Buy {
            policy_id,
            nonce,
            market,
            direction,
            quote_budget,
            limit_price,
        } => {
            let p = POLICY.load(deps.storage)?;
            validate(
                &p,
                &info.sender,
                env.block.time.seconds(),
                policy_id,
                nonce,
                &market,
                &direction,
                quote_budget,
                limit_price,
            )?;
            // Price is micro-USDT per INJ. Quantity is integer INJ base units.
            // Reserve 1% for fees, round down to 0.001 INJ lots. Reply independently
            // checks net bank debit, so a fee change cannot exceed the budget.
            let numerator = Uint256::from(quote_budget)
                * Uint256::from(100u128)
                * Uint256::from(1_000_000_000_000_000_000u128);
            let quantity: Uint128 = (numerator
                / (Uint256::from(limit_price) * Uint256::from(101u128))
                / Uint256::from(LOT)
                * Uint256::from(LOT))
            .try_into()
            .map_err(|_| fail("Quantity overflow"))?;
            if quantity.is_zero() {
                return Err(fail("Below quantity tick"));
            }
            let quote_before = deps
                .querier
                .query_balance(&env.contract.address, QUOTE)?
                .amount;
            let base_before = deps
                .querier
                .query_balance(&env.contract.address, "inj")?
                .amount;
            if quote_before < quote_budget {
                return Err(fail("Insufficient vault USDT"));
            }
            let (_, words, _) = bech32::decode(env.contract.address.as_str())
                .map_err(|_| fail("Invalid contract address"))?;
            let bytes =
                Vec::<u8>::from_base32(&words).map_err(|_| fail("Invalid address bytes"))?;
            if bytes.len() != 20 {
                return Err(fail("Injective 20-byte contract address required"));
            }
            let subaccount = format!("0x{}000000000000000000000000", hex::encode(bytes));
            let message = SpotMarketOrder {
                sender: env.contract.address.to_string(),
                order: Some(SpotOrder {
                    market_id: MARKET.into(),
                    order_info: Some(OrderInfo {
                        subaccount_id: subaccount,
                        fee_recipient: env.contract.address.to_string(),
                        price: limit_price.to_string(),
                        quantity: (Uint256::from(quantity)
                            * Uint256::from(1_000_000_000_000_000_000u128))
                        .to_string(),
                        cid: format!("aegis-{}-{}", p.id, nonce),
                    }),
                    order_type: 9,
                    trigger_price: String::new(),
                }),
            };
            PENDING.save(
                deps.storage,
                &Pending {
                    budget: quote_budget,
                    quote_before,
                    base_before,
                    policy_id,
                    nonce,
                },
            )?;
            Ok(Response::new().add_submessage(SubMsg::reply_on_success(
                CosmosMsg::Any(AnyMsg {
                    type_url: "/injective.exchange.v1beta1.MsgCreateSpotMarketOrder".into(),
                    value: message.encode_to_vec().into(),
                }),
                1,
            )))
        }
    }
}

#[allow(clippy::too_many_arguments)]
pub fn validate(
    p: &Policy,
    caller: &Addr,
    now: u64,
    id: u64,
    nonce: u64,
    market: &str,
    direction: &str,
    budget: Uint128,
    price: Uint128,
) -> StdResult<()> {
    if caller != p.agent {
        return Err(fail("Unauthorized agent"));
    }
    if id != p.id {
        return Err(fail("Wrong policy"));
    }
    if p.revoked {
        return Err(fail("Policy revoked"));
    }
    if now >= p.expires_at {
        return Err(fail("Policy expired"));
    }
    if market != MARKET || direction != "buy" {
        return Err(fail("Market or direction forbidden"));
    }
    if nonce != p.next_nonce {
        return Err(fail("Replay or invalid nonce"));
    }
    if budget.is_zero() || budget > p.per_order {
        return Err(fail("Per-order limit exceeded"));
    }
    if budget
        > p.cap
            .checked_sub(p.spent)
            .map_err(|_| fail("Invalid allowance"))?
    {
        return Err(fail("Cumulative cap exceeded"));
    }
    if price.is_zero() || price > p.max_price || price.u128() % 1000 != 0 {
        return Err(fail("Price bound or tick invalid"));
    }
    Ok(())
}

#[entry_point]
pub fn reply(deps: DepsMut, env: Env, msg: Reply) -> StdResult<Response> {
    if msg.id != 1 || msg.result.is_err() {
        return Err(fail("Exchange execution failed"));
    }
    let pending = PENDING.load(deps.storage)?;
    let quote_after = deps
        .querier
        .query_balance(&env.contract.address, QUOTE)?
        .amount;
    let base_after = deps
        .querier
        .query_balance(&env.contract.address, "inj")?
        .amount;
    let debit = pending
        .quote_before
        .checked_sub(quote_after)
        .map_err(|_| fail("Unexpected quote balance"))?;
    if debit.is_zero() || debit > pending.budget || base_after <= pending.base_before {
        return Err(fail("No fill or budget exceeded"));
    }
    let acquired = base_after.checked_sub(pending.base_before)?;
    POLICY.update(deps.storage, |mut p| -> StdResult<_> {
        if p.id != pending.policy_id || p.next_nonce != pending.nonce {
            return Err(fail("Policy changed"));
        }
        p.spent = p.spent.checked_add(pending.budget)?;
        p.next_nonce = p
            .next_nonce
            .checked_add(1)
            .ok_or_else(|| fail("Nonce overflow"))?;
        Ok(p)
    })?;
    PENDING.remove(deps.storage);
    Ok(Response::new()
        .add_attribute("action", "executed")
        .add_attribute("policy_id", pending.policy_id.to_string())
        .add_attribute("nonce", pending.nonce.to_string())
        .add_attribute("reserved_quote", pending.budget)
        .add_attribute("actual_quote_debit", debit)
        .add_attribute("base_acquired", acquired))
}

#[entry_point]
pub fn query(deps: Deps, _: Env, _: QueryMsg) -> StdResult<Binary> {
    to_json_binary(&State {
        owner: OWNER.load(deps.storage)?,
        policy: POLICY.may_load(deps.storage)?,
        chain: CHAIN.into(),
        market: MARKET.into(),
    })
}

// Minimal wire types from the official injective.exchange.v1beta1 protobuf.
// LegacyDec protobuf values are integer strings scaled by 10^18.
#[derive(Clone, PartialEq, Message)]
pub struct OrderInfo {
    #[prost(string, tag = "1")]
    pub subaccount_id: String,
    #[prost(string, tag = "2")]
    pub fee_recipient: String,
    #[prost(string, tag = "3")]
    pub price: String,
    #[prost(string, tag = "4")]
    pub quantity: String,
    #[prost(string, tag = "5")]
    pub cid: String,
}
#[derive(Clone, PartialEq, Message)]
pub struct SpotOrder {
    #[prost(string, tag = "1")]
    pub market_id: String,
    #[prost(message, optional, tag = "2")]
    pub order_info: Option<OrderInfo>,
    #[prost(int32, tag = "3")]
    pub order_type: i32,
    #[prost(string, tag = "4")]
    pub trigger_price: String,
}
#[derive(Clone, PartialEq, Message)]
pub struct SpotMarketOrder {
    #[prost(string, tag = "1")]
    pub sender: String,
    #[prost(message, optional, tag = "2")]
    pub order: Option<SpotOrder>,
}

#[cfg(test)]
mod tests;
