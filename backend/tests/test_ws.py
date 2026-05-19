import pytest
from starlette.testclient import TestClient
from starlette.websockets import WebSocketDisconnect

from app.core.ws import EngagementHub
from app.main import _ENG_PATH, app


def test_eng_path_regex_matches_scoped_mutations():
    eid = "11111111-1111-1111-1111-111111111111"
    assert _ENG_PATH.match(f"/api/engagements/{eid}/assets")
    assert _ENG_PATH.match(f"/api/engagements/{eid}")
    assert _ENG_PATH.match(f"/api/engagements/{eid}/paths/abc/steps")
    assert _ENG_PATH.match("/api/auth/login") is None
    assert _ENG_PATH.match("/api/finding-templates") is None


async def test_hub_broadcasts_and_drops_dead_sockets():
    hub = EngagementHub()

    class FakeWS:
        def __init__(self, fail=False):
            self.fail = fail
            self.sent = []

        async def send_json(self, msg):
            if self.fail:
                raise RuntimeError("closed")
            self.sent.append(msg)

    good, bad = FakeWS(), FakeWS(fail=True)
    await hub.join("e1", good)  # type: ignore[arg-type]
    await hub.join("e1", bad)  # type: ignore[arg-type]
    await hub.broadcast("e1", {"type": "changed"})

    assert good.sent == [{"type": "changed"}]
    # Dead socket pruned; a second broadcast still works.
    await hub.broadcast("e1", {"type": "again"})
    assert good.sent[-1] == {"type": "again"}


def test_ws_rejects_unauthenticated():
    client = TestClient(app)
    with pytest.raises(WebSocketDisconnect):
        with client.websocket_connect(
            "/ws/engagements/11111111-1111-1111-1111-111111111111"
        ):
            pass
