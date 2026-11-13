<?php

namespace App;

use Illuminate\Database\Eloquent\Model;

class Order extends Model
{
    protected $fillable = ['name', 'paid_price'];

    public function products(){
        return $this->hasMany(OrderProduct::class);
    }
}
