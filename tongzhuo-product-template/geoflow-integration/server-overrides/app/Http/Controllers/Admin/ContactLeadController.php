<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\ContactLead;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\View\View;

class ContactLeadController extends Controller
{
    public function index(Request $request): View
    {
        $status = (string) $request->query('status', '');
        if (! in_array($status, ['', 'new', 'contacted', 'qualified', 'closed'], true)) {
            $status = '';
        }

        $leads = ContactLead::query()
            ->when($status !== '', fn ($query) => $query->where('status', $status))
            ->orderByDesc('id')
            ->paginate(20)
            ->withQueryString();

        $counts = ContactLead::query()
            ->selectRaw('status, count(*) as total')
            ->groupBy('status')
            ->pluck('total', 'status');

        return view('admin.contact-leads.index', [
            'pageTitle' => '客户线索',
            'activeMenu' => 'contact_leads',
            'adminSiteName' => config('app.name'),
            'leads' => $leads,
            'total' => ContactLead::query()->count(),
            'status' => $status,
            'counts' => $counts,
        ]);
    }

    public function update(Request $request, int $leadId): RedirectResponse
    {
        $payload = $request->validate([
            'status' => ['required', 'in:new,contacted,qualified,closed'],
            'note' => ['nullable', 'string', 'max:2000'],
        ]);

        $lead = ContactLead::query()->findOrFail($leadId);
        $lead->forceFill([
            'status' => $payload['status'],
            'note' => $payload['note'] ?? null,
            'contacted_at' => in_array($payload['status'], ['contacted', 'qualified', 'closed'], true)
                ? ($lead->contacted_at ?? now())
                : null,
        ])->save();

        return back()->with('message', '客户线索已更新。');
    }
}
