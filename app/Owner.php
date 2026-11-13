<?php

namespace App;

use Illuminate\Database\Eloquent\Model;

class Owner extends Model
{
    protected $fillable = [
        'user_id', 'first_name', 'last_name', 'contact_number', 'address'
    ];

    public function user(){
        return $this->belongsTo(User::class);
    }

    public function pets(){
       return $this->hasMany(Pet::class);
    }

    public function getFullNameAttribute(){
        return $this->first_name . ' ' . $this->last_name;
    }
}
