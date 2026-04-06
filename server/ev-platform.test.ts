import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// Mock LLM调用，避免真实网络请求超时
vi.mock("./_core/llm", () => ({
  invokeLLM: vi.fn().mockRejectedValue(new Error("LLM mocked unavailable for testing")),
}));

function createCtx(): TrpcContext {
  return {
    user: null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => {} } as TrpcContext["res"],
  };
}

describe("maps.getDashboardStats", () => {
  it("returns kpi with expected fields", async () => {
    const caller = appRouter.createCaller(createCtx());
    const result = await caller.maps.getDashboardStats();
    expect(result).toHaveProperty("kpi");
    expect(result.kpi).toHaveProperty("poiCount");
    expect(result.kpi).toHaveProperty("roadCount");
    expect(result.kpi).toHaveProperty("stationCount");
    expect(result.kpi).toHaveProperty("exclusionCount");
    expect(typeof result.kpi.poiCount).toBe("number");
  });

  it("returns chart data arrays", async () => {
    const caller = appRouter.createCaller(createCtx());
    const result = await caller.maps.getDashboardStats();
    expect(Array.isArray(result.poiCategoryChart)).toBe(true);
    expect(Array.isArray(result.trafficDistrictChart)).toBe(true);
    expect(Array.isArray(result.evDemandChart)).toBe(true);
    expect(Array.isArray(result.topPois)).toBe(true);
  });
});

describe("maps.getPOI", () => {
  it("returns poi data array", async () => {
    const caller = appRouter.createCaller(createCtx());
    const result = await caller.maps.getPOI();
    expect(result).toHaveProperty("data");
    expect(Array.isArray(result.data)).toBe(true);
    if (result.data.length > 0) {
      const poi = result.data[0];
      expect(poi).toHaveProperty("id");
      expect(poi).toHaveProperty("name");
      expect(poi).toHaveProperty("latitude");
      expect(poi).toHaveProperty("longitude");
      expect(poi).toHaveProperty("evDemandScore");
    }
  });
});

describe("maps.getTrafficFlow", () => {
  it("returns traffic flow data", async () => {
    const caller = appRouter.createCaller(createCtx());
    const result = await caller.maps.getTrafficFlow();
    expect(result).toHaveProperty("data");
    expect(Array.isArray(result.data)).toBe(true);
  });
});

describe("maps.getExclusionZones", () => {
  it("returns exclusion zones", async () => {
    const caller = appRouter.createCaller(createCtx());
    const result = await caller.maps.getExclusionZones();
    expect(result).toHaveProperty("data");
    expect(Array.isArray(result.data)).toBe(true);
  });
});

describe("maps.getChargingStations", () => {
  it("returns charging stations", async () => {
    const caller = appRouter.createCaller(createCtx());
    const result = await caller.maps.getChargingStations();
    expect(result).toHaveProperty("data");
    expect(Array.isArray(result.data)).toBe(true);
  });
});

describe("analysis.quickScore", () => {
  it("returns valid score for fuzhou center", async () => {
    const caller = appRouter.createCaller(createCtx());
    const result = await caller.analysis.quickScore({ lat: 26.0756, lng: 119.3034 });
    expect(result).toHaveProperty("totalScore");
    expect(result).toHaveProperty("grade");
    expect(result).toHaveProperty("scoreBreakdown");
    expect(result.scoreBreakdown).toHaveProperty("poi");
    expect(result.scoreBreakdown).toHaveProperty("traffic");
    expect(result.scoreBreakdown).toHaveProperty("accessibility");
    expect(result.scoreBreakdown).toHaveProperty("competition");
    expect(result.totalScore).toBeGreaterThanOrEqual(0);
    expect(result.totalScore).toBeLessThanOrEqual(10);
  });

  it("returns exclusion conflict for restricted zone", async () => {
    const caller = appRouter.createCaller(createCtx());
    // 使用一个明确在禁区内的坐标（军事区附近）
    const result = await caller.analysis.quickScore({ lat: 26.08, lng: 119.28 });
    expect(result).toHaveProperty("exclusionConflicts");
    expect(Array.isArray(result.exclusionConflicts)).toBe(true);
  });

  it("returns nearby pois and stations", async () => {
    const caller = appRouter.createCaller(createCtx());
    const result = await caller.analysis.quickScore({ lat: 26.0756, lng: 119.3034 });
    expect(Array.isArray(result.nearbyPois)).toBe(true);
    expect(Array.isArray(result.nearbyStations)).toBe(true);
  });
});

describe("auth.logout", () => {
  it("clears session cookie", async () => {
    const clearedCookies: string[] = [];
    const ctx: TrpcContext = {
      user: { id: 1, openId: "test", name: "Test", email: null, loginMethod: null, role: "user", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() },
      req: { protocol: "https", headers: {} } as TrpcContext["req"],
      res: { clearCookie: (name: string) => clearedCookies.push(name) } as TrpcContext["res"],
    };
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.logout();
    expect(result.success).toBe(true);
    expect(clearedCookies.length).toBe(1);
  });
});

describe("maps.getTrafficFlow path generation", () => {
  it("returns traffic data with path field", async () => {
    const caller = appRouter.createCaller(createCtx());
    const result = await caller.maps.getTrafficFlow();
    expect(result.data.length).toBeGreaterThan(0);
    const road = result.data[0];
    expect(road).toHaveProperty("path");
    expect(Array.isArray(road.path)).toBe(true);
    expect(road.path.length).toBeGreaterThanOrEqual(2);
    const point = road.path[0];
    // path格式支持两种：[lng, lat]数组或 {lat, lng}对象
    if (Array.isArray(point)) {
      expect(point.length).toBeGreaterThanOrEqual(2);
      expect(typeof point[0]).toBe("number");
      expect(typeof point[1]).toBe("number");
    } else {
      expect(point).toHaveProperty("lat");
      expect(point).toHaveProperty("lng");
    }
  });
});

describe("reports.generate fallback", () => {
  it("generates report without LLM (fallback mode)", async () => {
    const caller = appRouter.createCaller(createCtx());
    const result = await caller.reports.generate({
      lat: 26.0756, lng: 119.3034,
      address: "福州市鼓楼区五四路",
      sessionId: "test-session-" + Date.now(),
    });
    expect(result).toHaveProperty("reportContent");
    expect(typeof result.reportContent).toBe("string");
    expect(result.reportContent.length).toBeGreaterThan(100);
    expect(result).toHaveProperty("score");
    expect(result).toHaveProperty("address");
  }, 15000);
});

describe("analysis.aiAnalysis fallback", () => {
  it("returns analysis content without LLM (fallback mode)", async () => {
    const caller = appRouter.createCaller(createCtx());
    const result = await caller.analysis.aiAnalysis({
      lat: 26.0756, lng: 119.3034,
      userMessage: "这个位置适合建充电桩吗？",
      sessionId: "test-session-" + Date.now(),
    });
    expect(result).toHaveProperty("content");
    expect(typeof result.content).toBe("string");
    expect(result.content.length).toBeGreaterThan(50);
    expect(result).toHaveProperty("score");
  }, 15000);
});
