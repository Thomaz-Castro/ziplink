"""
ZipLink Load Test — Redirect Endpoint
======================================
Target: 500+ req/s sustained for 60s

Usage:
  pip install locust
  locust -f locustfile.py --headless -u 600 -r 60 -t 90s \
    --host http://localhost:3000 \
    --html report.html

Dashboard (interactive):
  locust -f locustfile.py --host http://localhost:3000
  Open http://localhost:8089
"""

import random
import string
from locust import HttpUser, task, between, events
from locust.runners import MasterRunner

# Pre-seeded slugs — populated via /setup endpoint or fixed list
SLUGS: list[str] = []

# Fallback static slugs used if seeding fails (populate these manually)
STATIC_SLUGS = [
    "test001", "test002", "test003", "test004", "test005",
    "test006", "test007", "test008", "test009", "test010",
]


@events.test_start.add_listener
def on_test_start(environment, **kwargs):
    """Seed test slugs from the API before the test begins."""
    if isinstance(environment.runner, MasterRunner):
        return

    host = environment.host
    import requests

    try:
        # Register a throwaway test user
        email = f"loadtest_{''.join(random.choices(string.ascii_lowercase, k=6))}@test.com"
        reg = requests.post(f"{host}/api/auth/register", json={"email": email, "password": "testpass123"}, timeout=10)
        token = reg.json().get("token")

        if not token:
            print("[setup] Could not obtain token, using static slugs")
            SLUGS.extend(STATIC_SLUGS)
            return

        headers = {"Authorization": f"Bearer {token}"}

        # Create 50 test links
        created = 0
        for i in range(50):
            res = requests.post(
                f"{host}/api/links",
                json={"original_url": f"https://example.com/destination/{i}", "title": f"Load test {i}"},
                headers=headers,
                timeout=5,
            )
            if res.status_code == 201:
                SLUGS.append(res.json()["slug"])
                created += 1

        print(f"[setup] Seeded {created} test links for load test")

    except Exception as exc:
        print(f"[setup] Warning: {exc} — falling back to static slugs")
        SLUGS.extend(STATIC_SLUGS)


class RedirectUser(HttpUser):
    """
    Simulates a user hitting the redirect endpoint.
    This is the critical path: Redis cache lookup → (miss) Postgres lookup → 302.
    """
    # Tight think time to maximise throughput per user
    wait_time = between(0.05, 0.2)

    @task(90)
    def hit_redirect(self):
        """90% of traffic hits valid slugs (warm cache after first pass)."""
        if not SLUGS:
            return
        slug = random.choice(SLUGS)
        with self.client.get(
            f"/{slug}",
            allow_redirects=False,  # Don't follow redirect — we only measure the 302 response
            catch_response=True,
            name="/[slug] redirect",
        ) as response:
            if response.status_code in (301, 302):
                response.success()
            elif response.status_code == 404:
                response.failure(f"Slug {slug!r} not found (404)")
            else:
                response.failure(f"Unexpected status {response.status_code}")



class ApiUser(HttpUser):
    """
    Secondary user class: creates + lists links to generate mixed API load.
    Kept at low weight — load test focus is the redirect endpoint.
    """
    weight = 1
    wait_time = between(2, 5)
    token: str = ""

    def on_start(self):
        email = f"api_{''.join(random.choices(string.ascii_lowercase, k=6))}@test.com"
        res = self.client.post("/api/auth/register", json={"email": email, "password": "testpass123"})
        if res.status_code == 201:
            self.token = res.json().get("token", "")
        else:
            self.token = ""

    @task
    def create_and_list(self):
        if not self.token:
            return
        headers = {"Authorization": f"Bearer {self.token}"}
        self.client.post(
            "/api/links",
            json={"original_url": "https://example.com/api-load-test"},
            headers=headers,
            name="/api/links [POST]",
        )
        self.client.get("/api/links", headers=headers, name="/api/links [GET]")
