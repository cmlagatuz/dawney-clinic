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
                    <input type="text" name="name" class="form-control @error('name') is-invalid @enderror" value="{{ $product->name }}">
                    @error('name')
                        <span class="invalid-feedback" role="alert">
                            <strong>{{ $message }}</strong>
                        </span>
                    @enderror
                </div>
                <div class="form-group">
                    <label for="">Price</label>
                    <input type="text" name="price" class="form-control @error('price') is-invalid @enderror" value="{{ $product->price }}">
                    @error('price')
                        <span class="invalid-feedback" role="alert">
                            <strong>{{ $message }}</strong>
                        </span>
                    @enderror
                </div>
                <div class="form-group">
                    <label for="">Stock</label>
                    <input type="text" name="stock" class="form-control @error('stock') is-invalid @enderror" placeholder="Add new Stock">
                    @error('stock')
                        <span class="invalid-feedback" role="alert">
                            <strong>{{ $message }}</strong>
                        </span>
                    @enderror
                </div>
                <div class="form-group">
                    <table class="table">
                        <thead>
                            <tr>
                                <th colspan="3" class="text-center">
                                    List of Stocks
                                </th>
                            </tr>
                            <tr>
                                <th>Date</th>
                                <th>Stock</th>
                                <th>Quantity</th>
                            </tr>
                        </thead>
                        <tbody>
                            @foreach ($product->stocks as $stock)
                                <tr>
                                    <td scope="row">
                                        {{ $stock->created_at->format('M d Y') }}
                                    </td>
                                    <td>
                                        {{ $stock->stock }}
                                    </td>
                                    <td>
                                        {{ $stock->quantity }}
                                    </td>
                                </tr>
                            @endforeach
                            @if(count($product->stocks) == 0)
                                <tr>
                                    <td colspan="3" class="text-center">
                                        No Records Founds
                                    </td>
                                </tr>
                            @endif
                        </tbody>
                    </table>
                </div>
                <div class="form-group">
                    <hr>
                    @csrf
                    <button class="btn btn-primary">Update</button>
                </div>
            </form>
        </div>
    </div>
@endsection
