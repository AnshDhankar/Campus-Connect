/**
 * CampusConnect — Synthetic Load Testing & Capacity Benchmark Script (Workstream F)
 * 
 * Simulates staged concurrent virtual user requests against the running application:
 * Stages: 10, 25, 50, 100 concurrent requests
 * 
 * Measures:
 * 1. Total Requests & Duration
 * 2. Requests per second (RPS throughput)
 * 3. Latency distribution (p50, p95, p99)
 * 4. HTTP response status breakdown (2xx, 429 rate-limited, 5xx errors)
 * 5. Memory usage (Resident Set Size & Heap Used)
 */

import http from 'http';

interface BenchmarkResult {
  concurrency: number;
  totalRequests: number;
  durationMs: number;
  rps: number;
  p50Ms: number;
  p95Ms: number;
  p99Ms: number;
  status2xx: number;
  status429: number;
  status5xx: number;
  heapUsedMb: number;
}

async function makeRequest(url: string): Promise<{ status: number; durationMs: number }> {
  const start = performance.now();
  return new Promise((resolve) => {
    const req = http.get(url, (res) => {
      res.on('data', () => {});
      res.on('end', () => {
        resolve({
          status: res.statusCode || 0,
          durationMs: performance.now() - start
        });
      });
    });
    req.on('error', () => {
      resolve({
        status: 0,
        durationMs: performance.now() - start
      });
    });
    req.end();
  });
}

async function runStage(concurrency: number, totalRequests: number, targetUrl: string): Promise<BenchmarkResult> {
  const latencies: number[] = [];
  let status2xx = 0;
  let status429 = 0;
  let status5xx = 0;

  const startTime = performance.now();
  let completed = 0;
  let inFlight = 0;
  let dispatched = 0;

  await new Promise<void>((resolve) => {
    function launchNext() {
      if (completed >= totalRequests) {
        return resolve();
      }

      while (inFlight < concurrency && dispatched < totalRequests) {
        dispatched++;
        inFlight++;

        makeRequest(targetUrl).then(({ status, durationMs }) => {
          inFlight--;
          completed++;
          latencies.push(durationMs);

          if (status >= 200 && status < 300) status2xx++;
          else if (status === 429) status429++;
          else if (status >= 500) status5xx++;

          launchNext();
        });
      }
    }

    launchNext();
  });

  const durationMs = performance.now() - startTime;
  latencies.sort((a, b) => a - b);

  const p50 = latencies[Math.floor(latencies.length * 0.5)] || 0;
  const p95 = latencies[Math.floor(latencies.length * 0.95)] || 0;
  const p99 = latencies[Math.floor(latencies.length * 0.99)] || 0;
  const mem = process.memoryUsage();

  return {
    concurrency,
    totalRequests,
    durationMs: Math.round(durationMs),
    rps: parseFloat(((totalRequests / durationMs) * 1000).toFixed(1)),
    p50Ms: parseFloat(p50.toFixed(2)),
    p95Ms: parseFloat(p95.toFixed(2)),
    p99Ms: parseFloat(p99.toFixed(2)),
    status2xx,
    status429,
    status5xx,
    heapUsedMb: parseFloat((mem.heapUsed / 1024 / 1024).toFixed(1))
  };
}

async function runBenchmark() {
  const targetPort = 3000;
  const targetUrl = `http://127.0.0.1:${targetPort}/api/health/liveness`;

  console.log('\n================================================================');
  console.log('  CAMPUSCONNECT HIGH-TRAFFIC CAPACITY & LOAD BENCHMARK');
  console.log(`  Target: ${targetUrl}`);
  console.log('================================================================\n');

  const stages = [
    { concurrency: 10, requests: 200 },
    { concurrency: 25, requests: 300 },
    { concurrency: 50, requests: 500 },
    { concurrency: 100, requests: 500 },
  ];

  const results: BenchmarkResult[] = [];

  for (const stage of stages) {
    console.log(`Executing Stage: Concurrency = ${stage.concurrency}, Total Requests = ${stage.requests}...`);
    const res = await runStage(stage.concurrency, stage.requests, targetUrl);
    results.push(res);
    console.log(`  -> Duration: ${res.durationMs}ms | Throughput: ${res.rps} req/sec`);
    console.log(`  -> Latencies: p50=${res.p50Ms}ms, p95=${res.p95Ms}ms, p99=${res.p99Ms}ms`);
    console.log(`  -> Statuses: 2xx=${res.status2xx}, 429=${res.status429}, 5xx=${res.status5xx} | Heap: ${res.heapUsedMb} MB\n`);
  }

  console.log('----------------------------------------------------------------');
  console.log('BENCHMARK SUMMARY MATRIX:');
  console.log('----------------------------------------------------------------');
  console.log('Concurrency | Total Reqs | Throughput (RPS) | p50 (ms) | p95 (ms) | p99 (ms) | Errors (5xx)');
  results.forEach(r => {
    console.log(
      `${String(r.concurrency).padEnd(12)}| ${String(r.totalRequests).padEnd(11)}| ${String(r.rps).padEnd(17)}| ${String(r.p50Ms).padEnd(9)}| ${String(r.p95Ms).padEnd(9)}| ${String(r.p99Ms).padEnd(9)}| ${r.status5xx}`
    );
  });
  console.log('----------------------------------------------------------------\n');
}

runBenchmark().catch(err => {
  console.error('Benchmark execution error:', err);
  process.exit(1);
});
