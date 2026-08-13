import http from "k6/http";
import { check, sleep } from "k6";

export const options = {
  scenarios: {
    peak_vote_traffic: {
      executor: "constant-arrival-rate",
      rate: 1000,
      timeUnit: "1s",
      duration: "30s",
      preAllocatedVUs: 200,
      maxVUs: 1000,
    },
  },
  thresholds: {
    http_req_failed: ["rate<0.01"],
    http_req_duration: ["p(95)<300"],
  },
};

const BASE_URL = __ENV.BASE_URL || "http://localhost:3000";
const CANDIDATE_IDS = (__ENV.CANDIDATE_IDS || "1,2").split(",");

export default function () {
  const candidateId = CANDIDATE_IDS[Math.floor(Math.random() * CANDIDATE_IDS.length)];

  const res = http.post(
    `${BASE_URL}/votes`,
    JSON.stringify({ candidate_id: candidateId }),
    { headers: { "Content-Type": "application/json" } }
  );

  check(res, { "status is 201": (r) => r.status === 201 });
  sleep(0.001);
}
