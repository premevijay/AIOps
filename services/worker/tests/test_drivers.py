"""Unit tests that need no network — driver diff, registry, write-gating."""

import pytest

from aiops_worker.drivers import get_driver, supported_os
from aiops_worker.drivers.base import DeviceDriver, WriteGatedError
from aiops_worker.models import Device, DeviceCredentials, DeviceType


def _device(os="ios"):
    return Device(name="cat9k-lab-01", vendor="Cisco Catalyst", os=os,
                  type=DeviceType.switch, mgmt_host="10.0.0.10", vault_path="aiops/lab/cat9k")


def _creds():
    return DeviceCredentials(username="admin", password="x", enable="y")


def test_catalyst_is_registered():
    assert "ios" in supported_os()
    driver = get_driver(_device(), _creds())
    assert driver.vendor_os == "ios"


def test_unknown_os_raises():
    with pytest.raises(ValueError):
        get_driver(_device(os="bananas"), _creds())


def test_diff_is_pure_and_unified():
    out = DeviceDriver.diff("a\nb\nc\n", "a\nB\nc\n")
    assert "-b" in out and "+B" in out


def test_writes_are_gated():
    driver = get_driver(_device(), _creds())
    with pytest.raises(WriteGatedError):
        driver.apply_config("interface Gi0/0\n shutdown")
    with pytest.raises(WriteGatedError):
        driver.rollback()
