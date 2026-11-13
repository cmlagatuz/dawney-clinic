@extends('layouts.admin')

@section('content')
<div class="card">
    <div class="card-header">Order #{{ $order->id }} Details</div>
    <div class="card-body">
        <div class="row justify-content-center">
            <div class="col-md-6">
                <table class="table">
                    <tbody>
                        <tr>
                            <td scope="row">Name</td>
                            <td>{{ $order->name }}</td>
                        </tr>
                        <tr>
                            <td scope="row">Purchase Date</td>
                            <td>{{ $order->created_at->format('M d Y h:i a') }}</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
        <hr>
        <div class="text-center">
            <h3>Products</h3>
        </div>
        <table class="table">
            <thead>
                <tr>
                    <th>Product Name</th>
                    <th>Quantity</th>
                    <th>Price</th>
                    <th>Sub Total</th>
                </tr>
            </thead>
            <tbody>
                @php
                    $total = 0
                @endphp
                @foreach ($order->products as $product)
                    <tr>
                        <td scope="row" width="50%">
                            {{ $product->product->name }}
                        </td>
                        <td>
                            {{ $product->quantity }}
                        </td>
                        <td>
                            ₱{{ number_format($product->product->price, 2) }}
                        </td>
                        <td>
                            ₱{{ number_format($product->quantity * $product->product->price, 2) }}
                        </td>
                    </tr>
                    @php
                        $total+= $product->quantity * $product->product->price;
                    @endphp
                @endforeach
                <tr>
                    <td colspan="3" class="text-right"><b>Grand Total: </b></td>
                    <td>
                        ₱{{ number_format($total, 2) }}
                    </td>
                </tr>
            </tbody>
        </table>
    </div>
</div>
@endsection
