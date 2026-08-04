<?php

/**
 * GEOFlow 涓氬姟鐩稿叧閰嶇疆锛堢珯鐐逛俊鎭€佸悗鍙拌矾寰勩€佷笂浼犮€佺紦瀛樸€佷細璇濅笌瀹夊叏锛夈€? *
 * 鐜鍙橀噺閿悕涓庨粯璁ゅ€艰鍚勬潯鐩梺娉ㄩ噴锛涗慨鏀瑰悗寤鸿 `php artisan config:clear`銆? */
$adminBasePath = trim((string) env('ADMIN_BASE_PATH', 'geo_admin'), '/');
$adminBasePath = $adminBasePath !== '' ? $adminBasePath : 'geo_admin';
$defaultUpdateMetadataUrl = '';
$updateMetadataUrl = trim((string) env('GEOFLOW_UPDATE_METADATA_URL', $defaultUpdateMetadataUrl));
$updateMetadataUrl = $updateMetadataUrl !== '' ? $updateMetadataUrl : $defaultUpdateMetadataUrl;

return [

    // 绔欑偣灞曠ず鍚嶇О锛堥〉鐪夈€佹爣棰樼瓑锛?    'site_name' => env('SITE_NAME', 'GEOFlow'),
    // 绔欑偣瀹屾暣/鍓爣棰樻枃妗?    'site_full_name' => env('SITE_FULL_NAME', 'GEOFlow'),
    // 绔欑偣鏍?URL锛岀敤浜庣敓鎴愮粷瀵归摼鎺ワ紙鏈熬鏃犳枩鏉狅級
    'site_url' => rtrim((string) env('SITE_URL', 'http://localhost'), '/'),
    // SEO 鎻忚堪
    'site_description' => env('SITE_DESCRIPTION', ''),
    // SEO 鍏抽敭璇嶏紙閫楀彿鍒嗛殧绛夛紝渚濆墠绔娇鐢ㄦ柟寮忥級
    'site_keywords' => env('SITE_KEYWORDS', ''),

    // 鍚庡彴鍏ュ彛璺緞鍓嶇紑锛屽 /geo_admin锛堝嬁涓庡墠鍙拌矾鐢卞啿绐侊級
    'admin_base_path' => '/'.$adminBasePath,

    // 鍓嶅彴 Blade 浣跨敤鐨?Laravel 缈昏瘧 locale锛堜笌 APP_LOCALE銆佸悗鍙颁細璇濊瑷€鐙珛锛涘榻愭棫绔欎腑鏂囧鑸級
    'public_locale' => env('GEOFLOW_PUBLIC_LOCALE', 'zh_CN'),
    // 榛樿鍓嶅彴涓婚锛涘悗鍙版湭鏄惧紡閫夋嫨涓婚鏃朵娇鐢?    'default_theme' => env('GEOFLOW_DEFAULT_THEME', 'toutiao-news-20260426'),

    // 褰撳墠绯荤粺鐗堟湰锛堝簳閮ㄥ睍绀恒€佸唴閮ㄧ淮鎶ゅ姣旓級
    'app_version' => env('GEOFLOW_APP_VERSION', '2.0'),
    // 娆㈣繋寮圭獥銆屼粙缁嶃€嶆枃妗堢増鏈細鍙樻洿鍚庢墍鏈夌鐞嗗憳浼氬啀娆＄湅鍒颁粙缁嶅脊绐?    'welcome_intro_version' => env('GEOFLOW_WELCOME_INTRO_VERSION', '2.0'),
    // 澶栭儴鐗堟湰鍏冩暟鎹湴鍧€锛涚敓浜ч粯璁ゅ叧闂紝閬垮厤鑷姩璁块棶绗笁鏂规洿鏂版簮銆?    'update_check_enabled' => filter_var(env('GEOFLOW_UPDATE_CHECK_ENABLED', env('APP_ENV') !== 'testing'), FILTER_VALIDATE_BOOLEAN),
    'update_metadata_url' => $updateMetadataUrl,
    'update_metadata_cache_ttl_seconds' => (int) env('GEOFLOW_UPDATE_METADATA_CACHE_TTL', 86400),

    // 鍓嶅彴鍒楄〃姣忛〉鏉℃暟
    'items_per_page' => (int) env('GEOFLOW_ITEMS_PER_PAGE', 12),
    // 鍚庡彴鍒楄〃姣忛〉鏉℃暟
    'admin_items_per_page' => (int) env('GEOFLOW_ADMIN_ITEMS_PER_PAGE', 20),
    // 鏍囬搴?AI 鐢熸垚鏃朵粠鍏抽敭璇嶅簱闅忔満鎶藉彇鐨勬渶澶ф潯鏁帮紙1鈥?00锛?    'title_ai_keyword_sample_limit' => max(1, min(100, (int) env('GEOFLOW_TITLE_AI_KEYWORD_SAMPLE_LIMIT', 10))),
    // URL 鏅鸿兘閲囬泦 SSRF 闃叉姢淇濇寔榛樿涓ユ牸锛涗粎鍦ㄦ槑纭彈鎺х殑閫忔槑浠ｇ悊/Docker/VPN DNS 鐜涓紑鍚€?    'url_import_allow_mixed_dns' => filter_var(env('URL_IMPORT_ALLOW_MIXED_DNS', false), FILTER_VALIDATE_BOOLEAN),
    'geo_engine' => [
        'driver' => env('GEO_ENGINE_DRIVER', 'local'),
        'base_url' => rtrim((string) env('GEO_ENGINE_BASE_URL', ''), '/'),
        'audit_path' => env('GEO_ENGINE_AUDIT_PATH', '/api/geo/audits'),
        'answer_test_path' => env('GEO_ENGINE_ANSWER_TEST_PATH', '/api/geo/answer-tests'),
        'opportunities_path' => env('GEO_ENGINE_OPPORTUNITIES_PATH', '/api/geo/opportunities'),
        'plan_path' => env('GEO_ENGINE_PLAN_PATH', '/api/geo/action-plans'),
        'api_key' => env('GEO_ENGINE_API_KEY', ''),
        'timeout_seconds' => (int) env('GEO_ENGINE_TIMEOUT_SECONDS', 60),
    ],
    // 涓?true 鏃惰褰曠煡璇嗗簱銆屾煡璇㈠悜閲忋€嶆槸鍚︾敱榛樿 embedding 鎺ュ彛鐢熸垚锛堜究浜庡鐓?bak 楠岃瘉锛涢粯璁ゅ叧闂級
    'debug_knowledge_query_embedding' => filter_var(env('GEOFLOW_DEBUG_KNOWLEDGE_QUERY_EMBEDDING', false), FILTER_VALIDATE_BOOLEAN),
    // 璇箟鍒囩墖瑙勫垝 prompt 鏈€澶у瓧绗︽暟锛涜秴杩囧悗鐩存帴璧扮粨鏋勫寲瑙勫垯鍥為€€锛岄伩鍏嶉暱鐭ヨ瘑搴撴嫋鎱㈡垨瓒呬笂涓嬫枃銆?    'semantic_chunking_max_chars' => max(1, (int) env('GEOFLOW_SEMANTIC_CHUNKING_MAX_CHARS', 20000)),

    // 鏈湴涓婁紶鏍圭洰褰曪紙缁濆璺緞锛?    'upload_path' => env('GEOFLOW_UPLOAD_PATH', public_path('assets/images')),
    // 涓婁紶璧勬簮瀵瑰璁块棶 URL 鍓嶇紑
    'upload_url' => env('GEOFLOW_UPLOAD_URL', '/assets/images/'),
    // 鍗曟枃浠朵笂浼犳渶澶у瓧鑺傛暟
    'max_upload_bytes' => (int) env('GEOFLOW_MAX_UPLOAD_BYTES', 2 * 1024 * 1024),

    // 鏄惁鍚敤 GEOFlow 涓氬姟灞傜紦瀛?    'cache_enabled' => filter_var(env('GEOFLOW_CACHE_ENABLED', true), FILTER_VALIDATE_BOOLEAN),
    // 涓氬姟缂撳瓨 TTL锛堢锛?    'cache_ttl_seconds' => (int) env('GEOFLOW_CACHE_TTL', 3600),

    // 閬楃暀浼氳瘽 Cookie 鍚嶏紙涓?bak 瀵归綈鏃跺彲鏀癸級
    'session_name' => env('GEOFLOW_SESSION_NAME', 'blog_secure_session'),
    // CSRF 闅愯棌瀛楁/input 鍚?    'csrf_token_name' => env('GEOFLOW_CSRF_TOKEN_NAME', 'csrf_token'),

    // ai_models API Key enc:v1 鏍规潗鏂欙紙浠呭湪姝よ鍙?APP_KEY锛涘簲鐢ㄤ唬鐮佺姝?env()锛岀粺涓€ config('geoflow.api_key_crypto_roots')锛?    'api_key_crypto_roots' => array_values(array_filter([(string) env('APP_KEY', '')])),

    // 鐧诲綍澶辫触閿佸畾鍓嶅厑璁稿皾璇曟鏁?    'max_login_attempts' => (int) env('GEOFLOW_MAX_LOGIN_ATTEMPTS', 5),
    // 瓒呭嚭娆℃暟鍚庨攣瀹氭椂闀匡紙绉掞級
    'login_lockout_seconds' => (int) env('GEOFLOW_LOGIN_LOCKOUT_SECONDS', 900),
    // API 鐧诲綍闄愰€燂細鍚屼竴璐﹀彿/IP 鍦ㄧ獥鍙ｆ湡鍐呮渶澶氬皾璇曟鏁?    'api_login_rate_limit_attempts' => (int) env('GEOFLOW_API_LOGIN_RATE_LIMIT_ATTEMPTS', 10),
    // API 鐧诲綍闄愰€熺獥鍙ｏ紙绉掞級
    'api_login_rate_limit_decay_seconds' => (int) env('GEOFLOW_API_LOGIN_RATE_LIMIT_DECAY', 60),
    // API Token 榛樿鏈夋晥鏈燂紙澶╋級
    'api_token_default_ttl_days' => (int) env('GEOFLOW_API_TOKEN_DEFAULT_TTL_DAYS', 30),
    // 浼氳瘽绌洪棽瓒呮椂锛堢锛?    'session_timeout_seconds' => (int) env('GEOFLOW_SESSION_TIMEOUT', 2592000),

    // OpenAI-compatible model gateway. Customer API keys are stored in the
    // database through Laravel's encrypted cast; never put a customer key in
    // this config file or a delivery package.
    'ai' => [
        'timeout_seconds' => max(3, min(180, (int) env('GEOFLOW_AI_TIMEOUT_SECONDS', 60))),
        'connect_timeout_seconds' => max(1, min(30, (int) env('GEOFLOW_AI_CONNECT_TIMEOUT_SECONDS', 10))),
        'max_retries' => max(0, min(4, (int) env('GEOFLOW_AI_MAX_RETRIES', 2))),
        'retry_sleep_ms' => max(50, min(5000, (int) env('GEOFLOW_AI_RETRY_SLEEP_MS', 300))),
        'expose_raw_response' => false,
    ],

    // Knowledge retrieval uses pgvector when PostgreSQL has the extension.
    // The JSON cosine fallback keeps private deployments functional on MySQL
    // and on PostgreSQL accounts that cannot install extensions.
    'rag' => [
        'pgvector' => filter_var(env('GEOFLOW_RAG_PGVECTOR', true), FILTER_VALIDATE_BOOLEAN),
        'chunk_size' => max(300, min(8000, (int) env('GEOFLOW_RAG_CHUNK_SIZE', 1200))),
        'chunk_overlap' => max(0, min(1000, (int) env('GEOFLOW_RAG_CHUNK_OVERLAP', 160))),
        'embedding_batch_size' => max(1, min(128, (int) env('GEOFLOW_RAG_EMBEDDING_BATCH_SIZE', 64))),
        'candidate_limit' => max(50, min(10000, (int) env('GEOFLOW_RAG_CANDIDATE_LIMIT', 2000))),
        'top_k' => max(1, min(20, (int) env('GEOFLOW_RAG_TOP_K', 6))),
        'vector_weight' => max(0, min(1, (float) env('GEOFLOW_RAG_VECTOR_WEIGHT', 0.72))),
        'excerpt_chars' => max(180, min(2000, (int) env('GEOFLOW_RAG_EXCERPT_CHARS', 480))),
    ],

];
