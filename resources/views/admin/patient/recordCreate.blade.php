@extends('layouts.admin')

@section('content')

    <div class="card">
        <div class="card-header">
            Create Record for Patient ({{ $patient->name }})
        </div>
        <div class="card-body">
            @if (session('status') || session('message'))
                <div class="alert {{ session('status') ? 'alert-success' : 'alert-danger'}}">
                    {{ session('message') }}
                </div>
            @endif
            <form method="POST" class="row">
                <div class="form-group col-md-12">
                    <label for="">Procedure</label>
                    <input type="text" class="form-control @error('procedure') is-invalid @enderror" name="procedure" value="{{ old('procedure') }}">
                    @error('procedure')
                        <span class="invalid-feedback" role="alert">
                            <strong>{{ $message }}</strong>
                        </span>
                    @enderror
                </div>
                <div class="form-group col-md-6">
                    <label for="">Temperature</label>
                    <input type="text" class="form-control @error('temperature') is-invalid @enderror" name="temperature" value="{{ old('temperature') }}">
                    @error('temperature')
                        <span class="invalid-feedback" role="alert">
                            <strong>{{ $message }}</strong>
                        </span>
                    @enderror
                </div>
                <div class="form-group col-md-6">
                    <label for="">Weight</label>
                    <input type="text" class="form-control @error('weight') is-invalid @enderror" name="weight" value="{{ old('weight') }}">
                    @error('weight')
                        <span class="invalid-feedback" role="alert">
                            <strong>{{ $message }}</strong>
                        </span>
                    @enderror
                </div>
                <div class="form-group col-md-12">
                    <label for="">Comments</label>
                    <textarea id="summernote" name="comment"></textarea>
                </div>
                <div class="form-group col-md-12">
                    @csrf
                    <button class="btn btn-primary">Create</button>
                </div>
            </form>
        </div>
    </div>

@endsection

@section('js')
    <script>
        $(function() {
            $('#summernote').summernote({
                height: 300,
            });
        });
    </script>
@endsection
