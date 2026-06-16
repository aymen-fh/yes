import { serializeDoc } from "../modules/common/serializers.js";

const toPlanDto = (plan) => {
  if (!plan) return null;

  const raw = plan.toObject ? plan.toObject() : plan;
  const dto = serializeDoc(raw);
  const dataLimitGb = dto.dataLimitGb ?? 0;
  const isUnlimited = dto.isUnlimited === true || dataLimitGb >= 999;
  const durationDays = dto.durationDays ?? (dto.durationMonths ?? 1) * 30;
  const validityLabel =
    dto.validityLabel ||
    (durationDays === 30 ? "شهر" : `${durationDays} يوم`);

  return {
    ...dto,
    price: dto.monthlyPrice ?? dto.price ?? 0,
    isUnlimited,
    durationMonths: dto.durationMonths ?? 1,
    durationDays,
    validityLabel,
    quotaGb: isUnlimited ? null : dataLimitGb,
  };
};

export const toPlanMobileDto = (plan) => toPlanDto(plan);

export const toSubscriptionMobileDto = (subscription) => {
  const dto = serializeDoc(subscription);
  const plan = subscription?.planId;

  if (plan && typeof plan === "object") {
    dto.plan = toPlanDto(plan);
    dto.planId = dto.plan?.id ?? dto.planId;
  }

  dto.number = dto.subscriptionNumber ?? dto.number ?? "";
  dto.nickname = dto.notes || dto.plan?.name || dto.number;
  dto.serviceType = dto.serviceType || "ftth";
  dto.branchName = dto.branchName || null;

  const dataLimitGb = dto.plan?.dataLimitGb ?? 0;
  dto.isUnlimited = dto.plan?.isUnlimited ?? dataLimitGb >= 999;

  return dto;
};

export const toTicketMobileDto = (ticket) => {
  const dto = serializeDoc(ticket);

  if (dto.subscriptionId && typeof dto.subscriptionId === "object") {
    dto.subscriptionId =
      dto.subscriptionId.id ?? dto.subscriptionId._id?.toString?.() ?? dto.subscriptionId;
  }

  return dto;
};

export const toSpeedTestDto = (result) => {
  if (!result) return null;
  const dto = serializeDoc(result);
  return {
    id: dto.id,
    subscriptionId: dto.subscriptionId?.toString?.() ?? dto.subscriptionId,
    pingMs: dto.pingMs,
    downloadMbps: dto.downloadMbps,
    uploadMbps: dto.uploadMbps,
    testedAt: dto.testedAt,
  };
};
