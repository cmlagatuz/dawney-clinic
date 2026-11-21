@extends('layouts.app')

@section('content')
    <div class="card mb-3">
        <div class="card-header">
            Patient Info - {{ $patient->name }}
        </div>
        <div class="card-body p-0">
            <div class="row">
                <div class="col-md-12">
                    <table class="table mb-0">
                        <tbody>
                            <tr>
                                <td scope="row" width="20%">ID:</td>
                                <td>{{ $patient->id }}</td>
                            </tr>
                            <tr>
                                <td scope="row" width="20%">Name:</td>
                                <td>{{ $patient->name }}</td>
                            </tr>
                            <tr>
                                <td scope="row" width="20%">Color:</td>
                                <td>{{ $patient->color }}</td>
                            </tr>
                            <tr>
                                <td scope="row" width="20%">Gender:</td>
                                <td>{{ $patient->gender_name }}</td>
                            </tr>
                            <tr>
                                <td scope="row" width="20%">Species:</td>
                                <td>{{ $patient->species_name }}</td>
                            </tr>
                            <tr>
                                <td scope="row" width="20%">Breed:</td>
                                <td>{{ $patient->breed }}</td>
                            </tr>
                            <tr>
                                <td scope="row" width="20%">Birth Date:</td>
                                <td>{{ $patient->birth_date->format('M d Y') }}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    </div>
    <div class="card mb-3">
        <div class="card-header">
            Patient Record
        </div>
        <div class="card-body p-0">
            <table class="table mb-0">
                <thead>
                    <tr>
                        <th>Date</th>
                        <th>Procedure</th>
                        <th>Action</th>
                    </tr>
                </thead>
                <tbody>
                    @foreach ($patient->records as $record)
                        <tr>
                            <td scope="row">{{ $record->created_at->format('M d Y') }}</td>
                            <td>{{ $record->procedure }}</td>
                            <td>
                                <a href="{{ route('user.pet.record.view',[
                                    'id' => $patient->id,
                                    'rId' => $record->id
                                ]) }}" class="btn btn-sm btn-primary">
                                    View
                                </a>
                            </td>
                        </tr>
                    @endforeach
                    @if(count($patient->records) == 0)
                        <tr>
                            <td colspan="3" class="text-center">No Record Found</td>
                        </tr>
                    @endif
                </tbody>
            </table>
        </div>
    </div>
@endsection
