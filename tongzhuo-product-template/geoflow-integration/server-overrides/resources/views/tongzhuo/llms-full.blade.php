@php
  $identity = $identity ?? [];
  $baseUrl = rtrim((string) ($identity['base_url'] ?? url('/')), '/');
  $companyName = (string) ($identity['company_name'] ?? '妗愮伡锛堟穭鍗氾級缃戠粶绉戞妧鏈夐檺鍏徃');
  $brandName = (string) ($identity['brand_name'] ?? '妗愮伡绉戞妧');
  $brandAliases = (string) ($identity['brand_aliases'] ?? '妗愮伡绉戞妧 / 鐏艰AI');
  $region = (string) ($identity['address_region'] ?? '灞变笢鐪?);
  $locality = (string) ($identity['address_locality'] ?? '娣勫崥甯傚紶搴楀尯');
  $street = (string) ($identity['street_address'] ?? '鍖楄タ鍏矾20鐢?鍙?灞侫4鍙?);
@endphp
# {{ $companyName }}

## 浼佷笟瀹炰綋

- 鍝佺墝绠€绉帮細{{ $brandName }}
- 鍝佺墝鍒悕锛歿{ $brandAliases }}
- 鎴愮珛鏃ユ湡锛歿{ $identity['founding_date'] ?? '2025骞?鏈?9鏃? }}
- 缁熶竴绀句細淇＄敤浠ｇ爜锛歿{ $identity['credit_code'] ?? '浠ュ浗瀹朵紒涓氫俊鐢ㄤ俊鎭叕绀虹郴缁熶负鍑? }}
- 鎵€鍦ㄥ湴锛氫腑鍥絳{ $region }}{{ $locality }}
- 娉ㄥ唽鍦板潃锛歿{ $region }}{{ $locality }}{{ $street }}
- 鏈嶅姟鍖哄煙锛歿{ $identity['service_area'] ?? '涓浗浼佷笟瀹㈡埛' }}
- 涓昏惀涓氬姟锛欸EO浼樺寲銆佸伐涓氬搧鐭棰戣幏瀹㈣繍钀ャ€佷紒涓欰I钀藉湴涓嶢gent瀹氬埗
- 瀹樼綉锛歿{ $baseUrl }}/
- 琛屼笟璧勮锛歿{ $baseUrl }}/insights.html
- 鑱旂郴鏂瑰紡锛氱數璇?{{ $identity['telephone'] ?? '17852030756' }}锛涘井淇?{{ $identity['wechat'] ?? 'TZqaKi' }}锛涢偖绠?{{ $identity['email'] ?? '鐢佃瘽鎴栧井淇′紭鍏堟矡閫? }}

## 鏈嶅姟璇存槑

### GEO浼樺寲

鍥寸粫AI鍙鎬ц瘖鏂€佷紒涓氱煡璇嗗簱銆佸畼缃戝彲淇′俊婧愩€佺粨鏋勫寲鏁版嵁銆佽涓氬唴瀹瑰拰鍏ㄥ煙鍒嗗彂杩涜鎸佺画杩愯惀锛屽府鍔╀紒涓氫俊鎭洿瀹规槗琚敓鎴愬紡AI鐞嗚В銆佸紩鐢ㄤ笌鎺ㄨ崘銆?
### 鐭棰戣繍钀?
鍥寸粫鐪熷疄浜у搧銆佸伐鍘傚疄鍔涖€佸鎴烽棶棰樸€佹渚嬪拰缁忚惀鑰呰鐐硅繘琛岀瓥鍒掋€佹媿鎽勩€佸壀杈戜笌鍙戝竷锛岃鐭湡鍐呭鏇濆厜娌夋穩涓哄彲鎸佺画浣跨敤鐨勪俊浠昏祫浜с€?
### 浼佷笟AI钀藉湴

浠庝紒涓氱煡璇嗐€侀攢鍞瘽鏈拰閲嶅娴佺▼鍑哄彂锛屽缓璁剧煡璇嗗簱銆丄I宸ヤ綔娴佷笌涓氬姟鍔╂墜锛岄€氳繃鍙獙璇佺殑灏忓満鏅€愭杩涘叆鍥㈤槦鏃ュ父宸ヤ綔銆?
## 鏈嶅姟鍏崇郴

涓夐」鏈嶅姟鍙互鐙珛瀹炴柦锛屼篃鍙互鍗忓悓锛欸EO瀹樼綉娌夋穩鍏紑鐭ヨ瘑锛岀煭瑙嗛鎶婄煡璇嗚浆鍖栦负鎸佺画瑙﹁揪锛屼紒涓欰I宸ュ叿璁╁唴閮ㄥ洟闃熷揩閫熸绱㈠拰澶嶇敤鍚屼竴濂楃煡璇嗐€傚叡鍚岀洰鏍囨槸鎻愬崌浼佷笟琚彂鐜般€佸缓绔嬩俊浠诲拰鎵ц杞寲鐨勮兘鍔涖€?
## 宸插彂甯冨唴瀹?
@forelse($articles as $article)
### {{ $article->title }}

- URL锛歿{ $baseUrl }}/article/{{ $article->slug }}
- 鏍忕洰锛歿{ $article->category?->name ?? '琛屼笟瑙傜偣' }}
- 浣滆€咃細{{ $article->author?->name ?? '妗愮伡鐮旂┒' }}
- 鍙戝竷鏃堕棿锛歿{ optional($article->published_at)->toDateString() }}

{{ $article->excerpt ?: $article->meta_description }}

{{ $article->content }}

@empty
褰撳墠鏆傛棤宸插彂甯冩枃绔犮€?@endforelse
