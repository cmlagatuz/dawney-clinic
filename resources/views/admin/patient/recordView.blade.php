@extends('layouts.admin')

@section('content')

<div class="card">
    <div class="card-header">
        <div class="float-right">
            <a href="{{ route('admin.patient.view', $record->pet_id) }}" class="btn btn-sm btn-primary">
                Patient Info
            </a>
        </div>
        <div class="pt-1">
            Record Details
        </div>
    </div>
    <div class="card-body">
        <div class="row justify-content-center">
            <div class="col-md-6">
                <table class="table">
                    <tbody>
                        <tr>
                            <td scope="row">Pet Name</td>
                            <td>{{ $record->pet->name }}</td>
                        </tr>
                        <tr>
                            <td scope="row">Procedure</td>
                            <td>{{ $record->procedure }}</td>
                        </tr>
                        <tr>
                            <td scope="row">Temperature</td>
                            <td>{{ $record->temperature }}°C</td>
                        </tr>
                        <tr>
                            <td scope="row">Weight</td>
                            <td>{{ $record->weight }}kg</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
        <hr>
        <h4 class="text-center">Notes</h4>
        <hr>
        {!! $record->comments  !!}
    </div>
</div>
@endsection
