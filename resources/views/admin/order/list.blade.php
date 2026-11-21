@extends('layouts.admin')

@section('content')
    <div class="card">
        <div class="card-header">
            Orders
        </div>
        <div class="card-body p-0">
            <table class="table">
                <thead>
                    <tr>
                        <th>OrderID</th>
                        <th>Name</th>
                        <th>Paid Price</th>
                        <th>Purchase Date</th>
                        <th>Action</th>
                    </tr>
                </thead>
                <tbody>
                    @foreach ($orders as $order)
                        <tr>
                            <td scope="row">
                                {{ $order->id }}
                            </td>
                            <td>{{ $order->name }}</td>
                            <td>₱{{ number_format($order->paid_price, 2) }}</td>
                            <td>{{ $order->created_at->format('M d Y h:i A') }}</td>
                            <td>
                                <a href="{{ route('admin.order.view', $order->id) }}" class="btn btn-sm btn-primary">View</a>
                            </td>
                        </tr>
                    @endforeach
                </tbody>
            </table>
            {{ $orders }}
        </div>
    </div>
@endsection
