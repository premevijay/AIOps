"""Unit tests that need no Ansible/AWX — op mapping, inventory/extravars, AWX map."""

from aiops_worker.execution import (
    OP_PLAYBOOK,
    build_extravars,
    build_inventory,
    parse_template_map,
)
from aiops_worker.models import Device, DeviceCredentials, DeviceType


def _device(os="ios"):
    return Device(name="cat9k-lab-01", vendor="Cisco Catalyst", os=os,
                  type=DeviceType.switch, mgmt_host="10.0.0.10", port=22,
                  vault_path="aiops/lab/cat9k-lab-01")


def _creds():
    return DeviceCredentials(username="admin", password="s3cret", enable="en")


def test_capabilities_map_to_playbooks():
    assert OP_PLAYBOOK["backup"] == "backup.yml"
    assert OP_PLAYBOOK["health"] == "health.yml"
    assert OP_PLAYBOOK["compliance"] == "compliance.yml"


def test_inventory_groups_by_os():
    inv = build_inventory(_device(os="nxos"))
    group = inv["all"]["children"]["network"]["children"]
    assert "nxos" in group
    host = group["nxos"]["hosts"]["cat9k-lab-01"]
    assert host["ansible_host"] == "10.0.0.10" and host["ansible_port"] == 22


def test_extravars_inject_credentials_and_target():
    ev = build_extravars(_device(), "/data/configs", _creds())
    assert ev["target"] == "cat9k-lab-01"
    assert ev["config_store"] == "/data/configs"
    assert ev["device_username"] == "admin"
    assert ev["device_password"] == "s3cret"
    assert ev["device_enable"] == "en"


def test_awx_template_map_parsing():
    assert parse_template_map("backup=12, health=13 ,compliance=14") == {
        "backup": "12", "health": "13", "compliance": "14",
    }
    assert parse_template_map("") == {}
