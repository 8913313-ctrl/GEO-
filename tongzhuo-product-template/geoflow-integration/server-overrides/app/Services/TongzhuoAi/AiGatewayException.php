<?php

namespace App\Services\TongzhuoAi;

use RuntimeException;

class AiGatewayException extends RuntimeException
{
    /** @param array<string,mixed> $details */
    public function __construct(
        string $message,
        private readonly string $errorCode = 'upstream_error',
        private readonly int $httpStatus = 502,
        private readonly bool $retryable = false,
        private readonly array $details = [],
    ) {
        parent::__construct($message);
    }

    public function errorCode(): string
    {
        return $this->errorCode;
    }

    public function httpStatus(): int
    {
        return $this->httpStatus;
    }

    public function retryable(): bool
    {
        return $this->retryable;
    }

    /** @return array<string,mixed> */
    public function details(): array
    {
        return $this->details;
    }
}
