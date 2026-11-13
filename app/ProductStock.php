<?php

namespace App;

use Illuminate\Database\Eloquent\Model;

class ProductStock extends Model
{

    protected $fillable = ['product_id', 'stock', 'quantity'];

    public function stock(){
        return $this->belongsTo(Product::class);
    }

}
