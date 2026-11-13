@extends('layouts.admin')

@section('content')
    <div class="card">
        <div class="card-header">
            Create Patient
        </div>
        <div class="card-body">
            @if (session('status') || session('message'))
                <div class="alert {{ session('status') ? 'alert-success' : 'alert-danger'}}">
                    {{ session('message') }}
                </div>
            @endif
            <form method="POST" class="row">
                <div class="form-group col-md-12 mb-1">
                    <h3 class="mb-0">Pet Details</h3>
                    <hr>
                </div>
                <div class="form-group col-md-12">
                    <label for="">Name</label>
                    <input type="text" name="name" class="form-control @error('name') is-invalid @enderror" value="{{ old('name') }}">
                    @error('name')
                        <span class="invalid-feedback" role="alert">
                            <strong>{{ $message }}</strong>
                        </span>
                    @enderror
                </div>
                <div class="form-group col-md-3">
                    <label for="">Gender</label>
                    <select name="gender" class="form-control @error('gender') is-invalid @enderror">
                        <option value="1">Male</option>
                        <option value="2">Female</option>
                    </select>
                    @error('gender')
                        <span class="invalid-feedback" role="alert">
                            <strong>{{ $message }}</strong>
                        </span>
                    @enderror
                </div>
                <div class="form-group col-md-3">
                    <label for="">Breed</label>
                    <input type="text" name="breed" class="form-control @error('breed') is-invalid @enderror" value="{{ old('breed') }}">
                    @error('breed')
                        <span class="invalid-feedback" role="alert">
                            <strong>{{ $message }}</strong>
                        </span>
                    @enderror
                </div>
                <div class="form-group col-md-6">
                    <label for="">Color</label>
                    <input type="text" name="color" class="form-control @error('color') is-invalid @enderror" value="{{ old('color') }}">
                    @error('color')
                        <span class="invalid-feedback" role="alert">
                            <strong>{{ $message }}</strong>
                        </span>
                    @enderror
                </div>
                <div class="form-group col-md-6">
                    <label for="">Species</label>
                    <select name="species" class="form-control @error('species') is-invalid @enderror">
                        @foreach (App\Pet::SPECIES as $species)
                            <option value="{{ $loop->iteration }}">{{ $species }}</option>
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
                <div class="form-group col-md-12 mb-1">
                    <hr>
                    <h3 class="mb-0">Owner Details</h3>
                    <hr>
                </div>

                <div class="form-group col-md-6">
                    <label for="">First Name</label>
                    <input type="text" name="first_name" class="form-control @error('first_name') is-invalid @enderror" value="{{ old('first_name') }}">
                    @error('name')
                        <span class="invalid-feedback" role="alert">
                            <strong>{{ $message }}</strong>
                        </span>
                    @enderror
                </div>
                <div class="form-group col-md-6">
                    <label for="">Last Name</label>
                    <input type="text" name="last_name" class="form-control @error('last_name') is-invalid @enderror" value="{{ old('last_name') }}">
                    @error('last_name')
                        <span class="invalid-feedback" role="alert">
                            <strong>{{ $message }}</strong>
                        </span>
                    @enderror
                </div>
                <div class="form-group col-md-6">
                    <label for="">Contact Number</label>
                    <input type="text" name="contact_number" class="form-control @error('contact_number') is-invalid @enderror" value="{{ old('contact_number') }}">
                    @error('contact_number')
                        <span class="invalid-feedback" role="alert">
                            <strong>{{ $message }}</strong>
                        </span>
                    @enderror
                </div>
                <div class="form-group col-md-6">
                    <label for="">Email Address</label>
                    <input type="email" name="email" class="form-control @error('email') is-invalid @enderror" value="{{ old('email') }}">
                    @error('email')
                        <span class="invalid-feedback" role="alert">
                            <strong>{{ $message }}</strong>
                        </span>
                    @enderror
                </div>
                <div class="form-group col-md-12">
                    <label for="">Address</label>
                    <input type="text" name="address" class="form-control @error('address') is-invalid @enderror" value="{{ old('address') }}">
                    @error('address')
                        <span class="invalid-feedback" role="alert">
                            <strong>{{ $message }}</strong>
                        </span>
                    @enderror
                </div>
                <div class="form-group col-md-12">
                    <hr>
                    @csrf
                    <button class="btn btn-primary">Create</button>
                </div>
            </form>
        </div>
    </div>
@endsection

@section('js')
    <script>
        $('#dateOnly').datetimepicker({
            format: 'L',
            maxDate: new Date(),
        });
    </script>
@endsection
