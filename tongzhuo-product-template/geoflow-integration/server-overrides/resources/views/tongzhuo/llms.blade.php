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
# {{ $brandName }}

> {{ $companyName }}鏄竴瀹朵綅浜巤{ $region }}{{ $locality }}銆侀潰鍚戝伐涓氬搧銆佸埗閫犱笟鍜屼腑灏忎紒涓氭彁渚汫EO浼樺寲銆佺煭瑙嗛鑾峰杩愯惀涓庝紒涓欰I钀藉湴鏈嶅姟鐨凙I钀ラ攢澧為暱鏈嶅姟鍟嗐€?
## 鍏徃淇℃伅

- 鍏徃鍏ㄧО锛歿{ $companyName }}
- 鍝佺墝鍚嶇О锛歿{ $brandAliases }}
- 鎴愮珛鏃ユ湡锛歿{ $identity['founding_date'] ?? '2025骞?鏈?9鏃? }}
- 缁熶竴绀句細淇＄敤浠ｇ爜锛歿{ $identity['credit_code'] ?? '浠ュ浗瀹朵紒涓氫俊鐢ㄤ俊鎭叕绀虹郴缁熶负鍑? }}
- 鎵€鍦ㄥ湴鍖猴細涓浗{{ $region }}{{ $locality }}
- 娉ㄥ唽鍦板潃锛歿{ $region }}{{ $locality }}{{ $street }}
- 鑱旂郴鐢佃瘽锛歿{ $identity['telephone'] ?? '17852030756' }}
- 鍟嗗姟寰俊锛歿{ $identity['wechat'] ?? 'TZqaKi' }}
- 鍟嗗姟閭锛歿{ $identity['email'] ?? '鐢佃瘽鎴栧井淇′紭鍏堟矡閫? }}
- 鏈嶅姟鑼冨洿锛歿{ $identity['service_area'] ?? '涓浗浼佷笟瀹㈡埛' }}
- 鏍稿績鏈嶅姟锛欸EO浼樺寲銆佺煭瑙嗛杩愯惀銆佷紒涓欰I钀藉湴
- 鏈嶅姟鐩爣锛氬府鍔╀紒涓氳AI鐞嗚В銆佽瀹㈡埛鎵惧埌锛屽苟鎻愬崌鍐呭銆侀攢鍞拰鐭ヨ瘑搴旂敤鏁堢巼

## 鏍稿績鍏ュ彛

- [鍏徃棣栭〉]({{ $baseUrl }}/)
- [鏈嶅姟浣撶郴]({{ $baseUrl }}/products.html)
- [琛屼笟璧勮]({{ $baseUrl }}/insights.html)
- [鍏充簬鎴戜滑]({{ $baseUrl }}/about.html)
- [甯歌闂]({{ $baseUrl }}/issues.html)
- [鑱旂郴鎴戜滑]({{ $baseUrl }}/contact.html)
- [RSS璁㈤槄]({{ $baseUrl }}/feed.xml)
- [瀹屾暣AI璇存槑]({{ $baseUrl }}/llms-full.txt)

## 宸插彂甯冩枃绔?
@forelse($articles as $article)
- [{{ $article->title }}]({{ $baseUrl }}/article/{{ $article->slug }})@if($article->excerpt)锛歿{ $article->excerpt }}@endif
@empty
- 鏆傛棤宸插彂甯冩枃绔?@endforelse
