@extends('layouts.admin')

@section('content')
    <div class="card">
        <div class="card-header">
            Place Order
        </div>
        <div class="card-body">
            <form id="placeOrder" class="row">
                <div class="form-group col-md-12">
                    <label for="">Customer</label>
                    <input type="text" class="form-control" name="name" required>
                </div>
                <div class="form-group col-md-12">
                    <hr>
                    <div class="row mb-2">
                        <div class="col-md-6">
                            <label for="">Products</label>
                            <select name="product" class="form-control">
                                    <option>Select Product</option>
                                @foreach ($products as $product)
                                    <option value="{{ $product->id }}" data-name="{{ $product->name }}" data-price="{{ $product->price }}">
                                        {{ $product->name . ' - ' . $product->stocks->sum('stock') }}
                                    </option>
                                @endforeach
                            </select>
                        </div>
                        <div class="col-md-3">
                            <label for="">Quantity</label>
                            <input type="text" name="product_quantity" class="form-control">
                        </div>
                        <div class="col-md-3 pt-1">
                            <button class="btn btn-primary btn-block mt-4" id="addProduct">Add Product</button>
                        </div>
                    </div>
                    <table class="table">
                        <thead>
                            <tr>
                                <th colspan="5" class="text-center">
                                    Ordered Products
                                </th>
                            </tr>
                            <tr>
                                <th>Product Name</th>
                                <th>Quantity</th>
                                <th>Price</th>
                                <th>Total</th>
                                <th>Action</th>
                            </tr>
                        </thead>
                        <tbody class="table-products">

                            <tr>
                                <td colspan="5"></td>
                            </tr>
                            <tr>
                                <td colspan="3" class="text-right">Grand Total</td>
                                <td>
                                    ₱ <span id="totalPrice"></span>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                <div class="form-group col-md-12">
                    <button class="btn btn-primary" id="submitBtn">Submit</button>
                </div>
            </form>
        </div>
    </div>
@endsection

@section('js')
    <script>
        $(function(){

            $.fn.extend({
            prependEvent: function (event, handler) {
                return this.each(function () {
                var events = $(this).data("events"),
                    currentHandler;

                if (events && events[event].length > 0) {
                    currentHandler = events[event][0].handler;
                    events[event][0].handler = function () {
                    handler.apply(this, arguments);
                    currentHandler.apply(this, arguments);
                    }
                }
                });
            }
            });

            var productName = '';
            var productPrice = '';

            var counter = 1;
            var totalAmount = 0;

            $('#totalPrice').html(totalAmount);

            var products = [];
            $('select[name="product"]').change(function(e){
                productName = $('option:selected', this).data('name');
                productPrice = $('option:selected', this).data('price');
            });

            $('#addProduct').click(function(e){
                e.preventDefault();

                var productID = $('select[name="product"]').val();

                if(productName == ''){
                   return alert('You need to select product first');
                }
                if(!$('input[name="product_quantity"]').val()){
                    return alert('You need to add quantity');
                }
                if(!isInt($('input[name="product_quantity"]').val())){
                    return alert('Integer only bro.');
                }

                var quantity = $('input[name="product_quantity"]').val();

                products.push({
                    'counter' : counter,
                    'productID': productID,
                    'productName': productName,
                    'productPrice': productPrice,
                    'productQuantity' : quantity
                });

                console.log(counter);

                var test = "<tr id='prod"+counter+"'>+"
                + "<td scope='row'> "+ productName +" </td>"
                + "<td>" + quantity + "</td>"
                + "<td>₱" + addCommas(productPrice) + "</td>"
                + "<td>₱" + addCommas(productPrice * quantity) + "</td>"
                + "<td><a id='remove' data-id='" + counter +"' class='btn btn-sm btn-danger'>Remove</a></td>"
                + "</tr>";

                totalAmount += (productPrice * quantity);

                $('#totalPrice').html(addCommas(totalAmount));

                $(".table tbody").prepend(test);

                $('input[name="product_quantity"]').val('')
                $("select[name='product'] option").prop("selected", false)

                counter++;

                console.log(products);
                // alert();
            })

            $('body').on('click', '#remove', function () {
                data = $(this).data('id');

                var index = products.findIndex(function(element){
                    return element.counter == data;
                })
                var product = products[index];

                var total = product.productPrice * product.productQuantity;
                totalAmount = totalAmount - total;
                $('#totalPrice').html(addCommas(totalAmount));

                products.splice(index, 1);
                // delete products[index];

                console.log(product);

                $('#prod'+data).remove();
                // alert(data);
            });

            // $('#remove').click(function(e){
            //     e.preventDefault();

            //     console.log($(this));
            // })

            // $("#remove").prependEvent("click", function () {
            //     console.log($(this));
            // })

            function addCommas(nStr){
                nStr += '';
                x = nStr.split('.');
                x1 = x[0];
                x2 = x.length > 1 ? '.' + x[1] : '';
                var rgx = /(\d+)(\d{3})/;
                while (rgx.test(x1)) {
                    x1 = x1.replace(rgx, '$1' + ',' + '$2');
                }
                return x1 + x2;
            }
            function isInt(value) {
                return !isNaN(value) && (function(x) { return (x | 0) === x; })(parseFloat(value))
            }

            $('#placeOrder').submit(function(e){
                e.preventDefault();

                if(products.length == 0){
                    return alert('Pleas add products first');
                }

                $('#submitBtn').attr('disabled', true);
                $.post("/admin/purchase",{
                    products: products,
                    name: $('input[name="name"]').val(),
                },function(data){
                    if(data.status){
                        alert(data.message);
                        window.location.href = '/admin/order/'+data.orderID
                    }else{
                        alert(data.message);
                    }
                    $('#submitBtn').attr('disabled', false);
                });
            })
        })
    </script>
@endsection
