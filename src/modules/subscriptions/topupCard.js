import { CouponCard } from "../dashboard/dashboard.models.js";
import { ValidationError } from "../../utils/errors.js";
import { toNumericSerial } from "../common/serializers.js";

const normalizePin = (value) => String(value || "").replace(/\D/g, "");

export function parseTopupScratchCode(scratchCode) {
  const trimmed = String(scratchCode || "").trim();
  if (!trimmed) return null;

  if (trimmed.startsWith("{")) {
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed?.type === "oxygen_recharge_card") {
        return {
          pin: parsed.pin ? String(parsed.pin) : null,
          serial: parsed.serial ? toNumericSerial(parsed.serial) : null,
        };
      }
    } catch {
      return null;
    }
  }

  return { pin: trimmed, serial: null };
}

export async function resolveTopupCouponCard({ pin, serial }) {
  const Model = CouponCard();
  const serialDigits = serial ? toNumericSerial(serial) : null;
  const pinRaw = pin ? String(pin).trim() : null;
  const pinDigits = normalizePin(pinRaw);

  if (serialDigits) {
    const bySerial = await Model.findOne({ serialNumber: serialDigits });
    if (bySerial) return bySerial;
  }

  if (pinRaw) {
    const pinMatchers = [{ pinCode: pinRaw }];
    if (pinDigits && pinDigits !== pinRaw) {
      pinMatchers.push({ pinCode: pinDigits });
    }

    const byPin = await Model.findOne({ $or: pinMatchers });
    if (byPin) return byPin;
  }

  return null;
}

export async function redeemTopupCouponCard(card) {
  const updated = await CouponCard().findOneAndUpdate(
    { _id: card._id, status: { $ne: "used" } },
    { status: "used" },
    { new: true }
  );

  if (!updated) {
    throw new ValidationError("تم استخدام هذا الكرت مسبقاً ولا يمكن تعبئته مجدداً");
  }

  return updated;
}
