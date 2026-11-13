@extends('layouts.admin')

@section('content')
    <div class="card">
        <div class="card-header">
            Create Product
        </div>
        <div class="card-body">
            <form method="POST">
                @if (session('status') || session('message'))
                    <div class="alert {{ session('status') ? 'alert-success' : 'alert-danger'}}">
                        {{ session('message') }}
                    </div>
                @endif
                <div class="form-group">
                    <label for="">Name</label>
                    <input type="text" name="name" class="form-control @error('name') is-invalid @enderror">
                    @error('name')
                        <span class="invalid-feedback" role="alert">
                            <strong>{{ $message }}</strong>
                        </span>
                    @enderror
                </div>
                <div class="form-group">
                    <label for="">Price</label>
                    <input type="text" name="price" class="form-control @error('price') is-invalid @enderror">
                    @error('price')
                        <span class="invalid-feedback" role="alert">
                            <strong>{{ $message }}</strong>
                        </span>
                    @enderror
                </div>
                <div class="form-group">
                    <hr>
                    @csrf
                    <button class="btn btn-primary">Create</button>
                </div>
            </form>
        </div>
    </div>
@endsection
