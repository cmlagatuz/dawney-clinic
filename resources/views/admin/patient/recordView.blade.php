@extends('layouts.admin')

@section('title', 'Record: ' . $record->pet->name)

@section('content')
@component('components.page-header', [
    'title' => 'Record Details',
    'subtitle' => $record->pet->name . ' · ' . $record->procedure,
])
    @slot('actions')
        <a href="{{ route('admin.patient.view', $record->pet_id) }}" class="btn btn-secondary">Patient Info</a>
    @endslot
@endcomponent

<div class="vitals" role="list" aria-label="Vitals recorded">
    <div class="stat" role="listitem">
        <span class="stat__value">{{ $record->temperature }}°C</span>
        <span class="stat__label">Temperature</span>
    </div>
    <div class="stat" role="listitem">
        <span class="stat__value">{{ $record->weight }} kg</span>
        <span class="stat__label">Weight</span>
    </div>
</div>

<div class="card">
    <div class="card-header">
        <dl class="facts p-0 mb-0">
            <div><dt>Pet Name</dt><dd>{{ $record->pet->name }}</dd></div>
            <div><dt>Procedure</dt><dd>{{ $record->procedure }}</dd></div>
        </dl>
    </div>
    <div class="card-body">
        <h2 class="h5">Notes</h2>
        @php
            // SECURITY: stored notes are never interpreted as HTML. Legacy notes were saved as Summernote HTML, so
            // turn block/line-break tags into newlines, drop every tag, decode entities, and let Blade ESCAPE the
            // result on output (so decoded "&lt;script&gt;" is shown as text, never executed). Formatting such as
            // bold/lists is intentionally not rendered; a sanitized rich-text path is the lead's decision.
            $plainNotes = html_entity_decode(
                strip_tags(preg_replace('/<\/(p|div|li|h[1-6])>|<br\s*\/?>/i', "\n", (string) $record->comments)),
                ENT_QUOTES | ENT_HTML5,
                'UTF-8'
            );
            $plainNotes = trim(preg_replace("/\n{3,}/", "\n\n", $plainNotes));
        @endphp
        <div class="record-notes">{{ $plainNotes }}</div>
    </div>
</div>
@endsection
