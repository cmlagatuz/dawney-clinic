@extends('layouts.admin')

@section('content')
    <div class="card">
        <div class="card-header">
            <div class="float-right">
                <a href="{{ route('admin.inventory.create') }}" class="btn btn-sm btn-primary">
                    Add New Product
                </a>
            </div>
            Inventory Products
        </div>
        <div class="card-body p-0">
            <table class="table mb-0">
                <thead>
                    <tr>
                        <th>ID</th>
                        <th>Product Name</th>
                        <th>Stock</th>
                        <th>Action</th>
                    </tr>
                </thead>
                <tbody>
                    @foreach ($products as $product)
                        <tr>
                            <td scope="row">
                                {{ $product->id }}
                            </td>
                            <td>{{ $product->name }}</td>
                            <td>{{ $product->stocks->sum('stock') ?? 0 }}</td>
                            <td>
                                <a href="{{ route('admin.inventory.update', $product->id) }}" class="btn btn-sm btn-primary">
                                    Update
                                </a>
                            </td>
                        </tr>
                    @endforeach

                    @if($products->total() == 0)
                        <tr>
                            <td colspan="4" class="text-center">
                                No Result Found
                            </td>
                        </tr>
                    @endif
                </tbody>
            </table>
            {{ $products }}
        </div>
    </div>
@endsection
