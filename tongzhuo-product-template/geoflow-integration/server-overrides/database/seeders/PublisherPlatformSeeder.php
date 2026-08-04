<?php

namespace Database\Seeders;

use App\Services\Publishing\PublisherPlatformCatalogService;
use Illuminate\Database\Seeder;

class PublisherPlatformSeeder extends Seeder
{
    public function run(): void
    {
        app(PublisherPlatformCatalogService::class)->ensureDefaults();
    }
}
