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
        {{-- Rich text from Summernote, rendered unescaped as before.
             SECURITY (for lead): sanitise server-side on save/render (e.g. HTMLPurifier); unescaped output is a stored-XSS risk. --}}
        <div class="record-notes">{!! $record->comments !!}</div>
    </div>
</div>
@endsection
