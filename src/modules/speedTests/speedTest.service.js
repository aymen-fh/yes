import { getCustomerDomainModels } from "../../utils/roleModels.js";
import { serializeDoc } from "../common/serializers.js";

const randomBetween = (min, max) => min + Math.random() * (max - min);

class SpeedTestService {
  static async runForSubscription({ subscription, customerId }) {
    const planSpeed = subscription?.planId?.speedMbps || 50;
    const variance = planSpeed * 0.12;

    const downloadMbps = Math.max(1, planSpeed + randomBetween(-variance, variance));
    const uploadMbps = Math.max(1, downloadMbps * randomBetween(0.22, 0.38));
    const pingMs = Math.max(5, randomBetween(8, 28));

    const { SpeedTest } = getCustomerDomainModels();
    const result = await SpeedTest.create({
      subscriptionId: subscription._id,
      customerId,
      pingMs: Number(pingMs.toFixed(1)),
      downloadMbps: Number(downloadMbps.toFixed(1)),
      uploadMbps: Number(uploadMbps.toFixed(1)),
      testedAt: new Date(),
    });

    return serializeDoc(result);
  }

  static async getLatest(subscriptionId) {
    const { SpeedTest } = getCustomerDomainModels();
    const latest = await SpeedTest.findOne({ subscriptionId })
      .sort({ testedAt: -1 })
      .lean();

    return latest ? serializeDoc(latest) : null;
  }
}

export default SpeedTestService;
