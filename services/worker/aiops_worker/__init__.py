"""AIOps connectivity worker — Phase 1 spine.

Resolves device credentials from a SecretProvider (CyberArk Conjur), connects
through a vendor DeviceDriver (Cisco Catalyst first), and serves read jobs off
the NATS bus.
"""

__version__ = "0.1.0"
