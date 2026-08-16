<?php

namespace App\Services\Publishing;

use App\Models\PublisherDevice;

/**
 * Persists device bearer credentials as one-way hashes.
 *
 * Existing installations stored the device secret in public_key. Successful
 * authentication of a legacy raw value upgrades it in place, so rollout does
 * not disconnect already-paired desktop agents.
 */
final class PublisherDeviceCredential
{
    private const HASH_PREFIX = 'sha256:';

    public static function store(string $secret): string
    {
        return self::HASH_PREFIX.hash('sha256', $secret);
    }

    public static function verify(PublisherDevice $device, string $presented): bool
    {
        $stored = trim((string) ($device->public_key ?? ''));
        if ($stored === '' || $presented === '') {
            return false;
        }

        $hashed = self::store($presented);
        if (str_starts_with($stored, self::HASH_PREFIX)) {
            return hash_equals($stored, $hashed);
        }

        // Backward compatibility for devices paired before this upgrade.
        $valid = hash_equals($stored, $presented);
        if ($valid) {
            try {
                $device->forceFill(['public_key' => $hashed])->save();
            } catch (\Throwable) {
                // Authentication must remain available if an old database has
                // not yet accepted the opportunistic in-place upgrade.
            }
        }

        return $valid;
    }
}