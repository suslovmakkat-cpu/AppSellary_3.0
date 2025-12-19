import json
from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Tuple

@dataclass
class MotivationRuleResult:
    kc_percent: float
    base_salary: float
    sales_component: float
    redemption_component: float
    fixed_bonuses: float
    percentage_bonus_value: float
    plan_multiplier: float
    plan_target: float
    plan_completion: float
    tax_bonus_percent: float = 0.0


class MotivationEngine:
    @staticmethod
    def parse_config(config_json: str) -> Dict[str, Any]:
        try:
            return json.loads(config_json or "{}")
        except Exception:
            return {}

    @staticmethod
    def _pick_progressive_percent(block: Dict[str, Any], redemption_percent: float) -> float:
        ranges = block.get("ranges") or []
        for rng in ranges:
            start = float(rng.get("from", 0))
            end_raw = rng.get("to")
            end = float(end_raw) if end_raw is not None else None
            if redemption_percent >= start and (end is None or redemption_percent <= end):
                return float(rng.get("percent") or 0)
        return float(block.get("percent") or 0)

    @staticmethod
    def calculate_components(
        config: Dict[str, Any],
        kc_amount: float,
        sales_amount: float,
        redemption_percent: float,
        working_days_in_period: float,
    ) -> MotivationRuleResult:
        blocks: List[Dict[str, Any]] = config.get("blocks") or []
        tax_bonus_percent = float(config.get("tax_bonus_percent") or 0)
        together_totals = {
            "base_salary": 0.0,
            "sales_component": 0.0,
            "redemption_component": 0.0,
            "fixed_bonuses": 0.0,
        }
        one_of_rewards: List[Tuple[float, str, float]] = []
        percentage_bonuses: List[float] = []
        plan_target = 0.0
        plan_completion = 1.0
        kc_percent_value = 0.0

        for block in blocks:
            if not isinstance(block, dict):
                continue
            block_type = block.get("type")
            apply_mode = block.get("apply_mode") or "together"

            payout = 0.0
            component_key = ""
            block_percent = 0.0

            if block_type == "fixed_salary":
                monthly = float(block.get("monthly_amount") or 0)
                days_in_period = float(working_days_in_period or 0)
                if monthly > 0 and days_in_period > 0:
                    payout = monthly / 20.0 * days_in_period
                    component_key = "base_salary"

            elif block_type == "percent_sales":
                percent = float(block.get("percent") or 0)
                payout = sales_amount * percent / 100.0
                component_key = "sales_component"

            elif block_type == "percent_redeemed":
                percent = float(block.get("percent") or 0)
                block_percent = percent
                payout = kc_amount * percent / 100.0
                component_key = "redemption_component"

            elif block_type == "progressive_redemption":
                percent = MotivationEngine._pick_progressive_percent(block, redemption_percent)
                block_percent = percent
                payout = kc_amount * percent / 100.0
                component_key = "redemption_component"

            elif block_type == "fixed_bonus":
                payout = float(block.get("amount") or 0)
                component_key = "fixed_bonuses"

            elif block_type == "percentage_bonus":
                percent = float(block.get("percent") or 0)
                if percent:
                    percentage_bonuses.append(percent)
                continue

            elif block_type == "sales_plan":
                plan_value = float(block.get("plan_value") or 0)
                plan_period = block.get("plan_period") or "monthly"
                if plan_value > 0 and working_days_in_period:
                    base_days = 5.0 if plan_period == "weekly" else 20.0
                    plan_target = plan_value / base_days * working_days_in_period
                    if plan_target > 0:
                        plan_completion = sales_amount / plan_target
                continue

            if payout <= 0:
                continue

            if apply_mode == "one_of":
                one_of_rewards.append((payout, component_key, block_percent))
            else:
                together_totals[component_key] += payout
                if component_key == "redemption_component":
                    kc_percent_value = max(kc_percent_value, block_percent)

        selected_one = max(one_of_rewards, key=lambda x: x[0], default=(0.0, "", 0.0))
        if selected_one[0] > 0 and selected_one[1]:
            together_totals[selected_one[1]] += selected_one[0]
            if selected_one[1] == "redemption_component":
                kc_percent_value = max(kc_percent_value, selected_one[2])

        base_total = sum(together_totals.values())

        plan_multiplier = plan_completion if plan_target > 0 else 1.0

        percent_bonus_value = sum(percentage_bonuses)

        return MotivationRuleResult(
            kc_percent=kc_percent_value,
            base_salary=together_totals["base_salary"],
            sales_component=together_totals["sales_component"],
            redemption_component=together_totals["redemption_component"],
            fixed_bonuses=together_totals["fixed_bonuses"],
            percentage_bonus_value=percent_bonus_value,
            plan_multiplier=plan_multiplier,
            plan_target=plan_target,
            plan_completion=plan_completion if plan_target > 0 else 1.0,
            tax_bonus_percent=tax_bonus_percent,
        )


def _to_number(value: Optional[float]) -> Optional[float]:
    if value in (None, ""):
        return None
    try:
        return float(value)
    except Exception:
        return None


def derive_amounts(
    kc_amount: float,
    non_kc_amount: float,
    sales_amount: float,
    redemption_percent: Optional[float] = None,
) -> Tuple[float, float, float, float]:
    kc_val = _to_number(kc_amount)
    non_kc_val = _to_number(non_kc_amount)
    sales_val = _to_number(sales_amount)
    red_val = _to_number(redemption_percent)

    provided = [v for v in [kc_val, non_kc_val, sales_val, red_val] if v is not None]

    kc_value = kc_val or 0.0
    non_kc_value = non_kc_val or 0.0
    sales_value = sales_val or 0.0

    if len(provided) >= 2:
        if kc_val is not None and sales_val is not None:
            non_kc_value = max(sales_value - kc_value, 0.0)
        elif kc_val is not None and non_kc_val is not None:
            sales_value = kc_value + non_kc_value
        elif sales_val is not None and non_kc_val is not None:
            kc_value = max(sales_value - non_kc_value, 0.0)
        elif sales_val is not None and red_val is not None:
            kc_value = sales_value * red_val / 100.0
            non_kc_value = max(sales_value - kc_value, 0.0)
        elif kc_val is not None and red_val is not None and red_val != 0:
            sales_value = kc_value * 100.0 / red_val
            non_kc_value = max(sales_value - kc_value, 0.0)
        elif non_kc_val is not None and red_val is not None and red_val < 100:
            sales_value = non_kc_value * 100.0 / (100.0 - red_val)
            kc_value = max(sales_value - non_kc_value, 0.0)
    elif len(provided) == 1:
        if sales_val is not None:
            kc_value = sales_value
            non_kc_value = 0.0
        elif kc_val is not None:
            sales_value = kc_value
            non_kc_value = 0.0
        elif non_kc_val is not None:
            sales_value = non_kc_value
            kc_value = 0.0

    redemption_percent = (kc_value / sales_value) * 100.0 if sales_value > 0 else 0.0
    return kc_value, non_kc_value, sales_value, redemption_percent
