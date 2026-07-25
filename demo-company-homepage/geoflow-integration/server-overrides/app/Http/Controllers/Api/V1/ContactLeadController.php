<?php

namespace App\Http\Controllers\Api\V1;

use App\Exceptions\ApiException;
use App\Models\ContactLead;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class ContactLeadController extends BaseApiController
{
    public function store(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'name' => ['required', 'string', 'max:80'],
            'phone' => ['required', 'string', 'max:80'],
            'company' => ['nullable', 'string', 'max:150'],
            'service' => ['required', 'string', 'max:100'],
            'website' => ['nullable', 'string', 'max:500'],
            'message' => ['required', 'string', 'max:5000'],
            'source_url' => ['nullable', 'string', 'max:500'],
        ]);

        if ($validator->fails()) {
            throw new ApiException('validation_failed', '请完整填写必填信息后再提交。', 422, [
                'field_errors' => $validator->errors()->toArray(),
            ]);
        }

        $lead = ContactLead::query()->create([
            ...$validator->validated(),
            'status' => 'new',
            'ip_address' => $request->ip(),
            'user_agent' => mb_substr((string) $request->userAgent(), 0, 500),
        ]);

        return $this->success($request, [
            'id' => (int) $lead->id,
            'message' => '提交成功，桐灼团队会尽快与您联系。',
        ]);
    }
}
