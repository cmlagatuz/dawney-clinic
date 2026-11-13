<!doctype html>
<html lang="en">
  <head>
    <title>Admin Panel - {{ config('app.name') }}</title>
    <!-- Required meta tags -->
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no">

    <link rel="stylesheet" href="{{ asset('css/app.css') }}">
    <link rel="stylesheet" href="{{ asset('css/admin.css') }}">
    <link href="https://cdnjs.cloudflare.com/ajax/libs/summernote/0.8.12/summernote-bs4.css" rel="stylesheet">
    <link rel="stylesheet" href="https://stackpath.bootstrapcdn.com/font-awesome/4.7.0/css/font-awesome.min.css">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/tempusdominus-bootstrap-4/5.0.0-alpha14/css/tempusdominus-bootstrap-4.min.css" />
</head>
  <body>

    <nav class="navbar navbar-expand-md navbar-light bg-white shadow-sm mb-3">
        <div class="container">
            <a class="navbar-brand" href="#">Admin Panel</a>
            <button class="navbar-toggler d-lg-none" type="button" data-toggle="collapse" data-target="#collapsibleNavId" aria-controls="collapsibleNavId"
                aria-expanded="false" aria-label="Toggle navigation">
                <span class="navbar-toggler-icon"></span>
            </button>
            <div class="collapse navbar-collapse" id="collapsibleNavId">
                <ul class="navbar-nav mr-auto mt-2 mt-lg-0">
                    <li class="nav-item {{ in_array(Route::currentRouteName(), [
                        'admin.dashboard',
                    ]) ? 'active' : '' }}">
                        <a class="nav-link" href="{{ route('admin.dashboard') }}">
                            Home
                        </a>
                    </li>
                    <li class="nav-item {{ in_array(Route::currentRouteName(), [
                        'admin.user.list',
                        'admin.user.update',
                        'admin.user.patient.create',
                    ]) ? 'active' : '' }}">
                        <a class="nav-link" href="{{ route('admin.user.list') }}">
                            Users
                        </a>
                    </li>
                    <li class="nav-item {{ in_array(Route::currentRouteName(), [
                        'admin.patient.list',
                        'admin.patient.view',
                        'admin.patient.update',
                        'admin.patient.create',
                        'admin.patient.record.create',
                        'admin.patient.record.view',
                    ]) ? 'active' : '' }}">
                        <a class="nav-link" href="{{ route('admin.patient.list') }}">
                            Patients
                        </a>
                    </li>
                    <li class="nav-item {{ in_array(Route::currentRouteName(), [
                        'admin.appointment.list',
                    ]) ? 'active' : '' }}">
                        <a href="{{ route('admin.appointment.list') }}" class="nav-link">
                            Appointments
                        </a>
                    </li>
                    {{-- <li class="nav-item {{ in_array(Route::currentRouteName(), [
                        'admin.inventory.list',
                        'admin.inventory.create',
                        'admin.inventory.update',
                    ]) ? 'active' : '' }}">
                        <a href="{{ route('admin.inventory.list') }}" class="nav-link">
                            Inventory
                        </a>
                    </li>
                    <li class="nav-item {{ in_array(Route::currentRouteName(), [
                        'admin.purchase.create',
                    ]) ? 'active' : '' }}">
                        <a href="{{ route('admin.purchase.create') }}" class="nav-link">
                            Place Order
                        </a>
                    </li>
                    <li class="nav-item {{ in_array(Route::currentRouteName(), [
                        'admin.order.list',
                        'admin.order.view',
                    ]) ? 'active' : '' }}">
                        <a href="{{ route('admin.order.list') }}" class="nav-link">
                            Orders
                        </a>
                    </li> --}}
                </ul>
                <ul class="navbar-nav ml-auto">
                    <li class="nav-item">
                        <a class="nav-link" href="{{ route('index') }}">Main Site</a>
                    </li>
                    <li class="nav-item dropdown">
                        <a id="navbarDropdown" class="nav-link dropdown-toggle" href="#" role="button" data-toggle="dropdown" aria-haspopup="true" aria-expanded="false" v-pre>
                            {{ Auth::user()->owner->full_name }} <span class="caret"></span>
                        </a>

                        <div class="dropdown-menu dropdown-menu-right" aria-labelledby="navbarDropdown">
                            <a class="dropdown-item" href="{{ route('logout') }}"
                                onclick="event.preventDefault();
                                                document.getElementById('logout-form').submit();">
                                {{ __('Logout') }}
                            </a>

                            <form id="logout-form" action="{{ route('logout') }}" method="POST" style="display: none;">
                                @csrf
                            </form>
                        </div>
                    </li>
                </ul>
            </div>
        </div>
    </nav>

    <div class="container">
        @yield('content')
    </div>

    <script src="https://code.jquery.com/jquery-3.3.1.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/popper.js/1.14.7/umd/popper.min.js" integrity="sha384-UO2eT0CpHqdSJQ6hJty5KVphtPhzWj9WO1clHTMGa3JDZwrnQq4sF86dIHNDz0W1" crossorigin="anonymous"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/moment.js/2.24.0/moment.js"></script>
    <script type="text/javascript" src="https://cdnjs.cloudflare.com/ajax/libs/tempusdominus-bootstrap-4/5.0.0-alpha14/js/tempusdominus-bootstrap-4.min.js"></script>
    <script src="https://stackpath.bootstrapcdn.com/bootstrap/4.3.1/js/bootstrap.min.js" integrity="sha384-JjSmVgyd0p3pXB1rRibZUAYoIIy6OrQ6VrjIEaFf/nJGzIxFDsf4x0xIM+B07jRM" crossorigin="anonymous"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/summernote/0.8.12/summernote-bs4.js"></script>

    @yield('js')
  </body>
</html>
