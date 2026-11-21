@extends('layouts.admin')

@section('content')
<div class="card">
    <div class="card-header">
        Update Patient {{ $patient->name }}
    </div>
    <div class="card-body">
        @if (session('status') || session('message'))
            <div class="alert {{ session('status') ? 'alert-success' : 'alert-danger'}}">
                {{ session('message') }}
            </div>
        @endif
        <form method="POST" class="row">
            <div class="form-group col-md-12">
                <label for="">Name</label>
                <input type="text" name="name" class="form-control @error('name') is-invalid @enderror" value="{{ $patient->name }}">
                @error('name')
                    <span class="invalid-feedback" role="alert">
                        <strong>{{ $message }}</strong>
                    </span>
                @enderror
            </div>
            <div class="form-group col-md-6">
                <label for="">Gender</label>
                <select name="gender" class="form-control @error('gender') is-invalid @enderror">
                    @foreach (App\Pet::GENDER as $gender)
                        <option value="{{ $loop->iteration }}" {{ $loop->iteration == $patient->gender ? 'selected' : ''}}>{{ $gender }}</option>
                    @endforeach
                    {{-- <option value="2">Female</option> --}}
                </select>
                @error('gender')
                    <span class="invalid-feedback" role="alert">
                        <strong>{{ $message }}</strong>
                    </span>
                @enderror
            </div>
            <div class="form-group col-md-3">
                <label for="">Color</label>
                <input type="text" name="color" class="form-control @error('color') is-invalid @enderror" value="{{ $patient->color }}">
                @error('color')
                    <span class="invalid-feedback" role="alert">
                        <strong>{{ $message }}</strong>
                    </span>
                @enderror
            </div>
            <div class="form-group col-md-3">
                <label for="">Breed</label>
                <input type="text" name="breed" class="form-control @error('breed') is-invalid @enderror" value="{{ $patient->breed }}">
                @error('breed')
                    <span class="invalid-feedback" role="alert">
                        <strong>{{ $message }}</strong>
                    </span>
                @enderror
            </div>
            <div class="form-group col-md-6">
                <label for="">Species</label>
                <select name="species" class="form-control @error('species') is-invalid @enderror">
                    @foreach (App\Pet::SPECIES as $species)
                        <option value="{{ $loop->iteration }}" {{ $loop->iteration == $patient->species ? 'selected' : '' }}>{{ $species }}</option>
                    @endforeach
                </select>
                @error('species')
                    <span class="invalid-feedback" role="alert">
                        <strong>{{ $message }}</strong>
                    </span>
                @enderror
            </div>
            <div class="form-group col-md-6">
                <label for="">Date of Birth</label>
                <div class="input-group date" id="dateOnly" data-target-input="nearest">
                    <input type="text" name="date_birth" class="form-control @error('date_birth') is-invalid @enderror datetimepicker-input" data-target="#dateOnly"/>
                    <div class="input-group-append" data-target="#dateOnly" data-toggle="datetimepicker">
                        <div class="input-group-text"><i class="fa fa-calendar"></i></div>
                    </div>

                    @error('date_birth')
                        <span class="invalid-feedback" role="alert">
                            <strong>{{ $message }}</strong>
                        </span>
                    @enderror
                </div>
            </div>

            <div class="form-group col-md-12">
                @csrf
                <button class="btn btn-primary">Update</button>
            </div>
        </form>
    </div>
</div>
@endsection

@section('js')
    <script>
        $('#dateOnly').datetimepicker({
            format: 'L',
            defaultDate: new Date('{{ $patient->birth_date->toDateString() }}'),
            // maxDate: new Date(),
        });
    </script>
@endsection
