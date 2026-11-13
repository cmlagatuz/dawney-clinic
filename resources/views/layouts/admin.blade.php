<!doctype html>
<html lang="en">
  <head>
    <title>@hasSection('title')@yield('title') · @endif Admin Panel - {{ config('app.name') }}</title>
    <!-- Required meta tags -->
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no">

    @include('partials.theme-init')

    <link rel="stylesheet" href="{{ asset('css/app.css') }}">
    <link rel="stylesheet" href="{{ asset('css/admin.css') }}">
    <link href="https://cdnjs.cloudflare.com/ajax/libs/summernote/0.8.12/summernote-bs4.css" rel="stylesheet">
    <link rel="stylesheet" href="https://stackpath.bootstrapcdn.com/font-awesome/4.7.0/css/font-awesome.min.css">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/tempusdominus-bootstrap-4/5.0.0-alpha14/css/tempusdominus-bootstrap-4.min.css" />
    <link rel="stylesheet" href="{{ asset('css/clinic-ui.css') }}">
</head>
  <body>
    <a class="skip-link" href="#main">Skip to main content</a>

    @php
        $currentRoute = Route::currentRouteName();
        // Same route groups as before, plus admin.user.view which previously highlighted nothing.
        // Inventory / Place Order / Orders stay disabled until their routes are re-enabled in routes/web.php.
        $adminNav = [
            ['label' => 'Home', 'route' => 'admin.dashboard', 'match' => ['admin.dashboard']],
            ['label' => 'Users', 'route' => 'admin.user.list', 'match' => [
                'admin.user.list', 'admin.user.view', 'admin.user.update', 'admin.user.patient.create',
            ]],
            ['label' => 'Patients', 'route' => 'admin.patient.list', 'match' => [
                'admin.patient.list', 'admin.patient.view', 'admin.patient.update', 'admin.patient.create',
                'admin.patient.record.create', 'admin.patient.record.view',
            ]],
            ['label' => 'Appointments', 'route' => 'admin.appointment.list', 'match' => ['admin.appointment.list']],
        ];
    @endphp

    <nav class="navbar navbar-expand-md navbar-light navbar-clinic mb-4" aria-label="Admin">
        <div class="container">
            <a class="navbar-brand" href="{{ route('admin.dashboard') }}">Admin Panel</a>
            <button class="navbar-toggler d-lg-none" type="button" data-toggle="collapse" data-target="#collapsibleNavId" aria-controls="collapsibleNavId"
                aria-expanded="false" aria-label="Toggle navigation">
                <span class="navbar-toggler-icon"></span>
            </button>
            <div class="collapse navbar-collapse" id="collapsibleNavId">
                <ul class="navbar-nav mr-auto mt-2 mt-lg-0">
                    @foreach ($adminNav as $item)
                        @php $isActive = in_array($currentRoute, $item['match']); @endphp
                        <li class="nav-item {{ $isActive ? 'active' : '' }}">
                            <a class="nav-link" href="{{ route($item['route']) }}" @if ($isActive) aria-current="page" @endif>
                                {{ $item['label'] }}
                            </a>
                        </li>
                    @endforeach
                </ul>
                <ul class="navbar-nav ml-auto">
                    <li class="nav-item">
                        <button type="button" class="nav-link theme-toggle" data-theme-toggle aria-label="Switch to dark theme">
                            <i class="fa fa-adjust" aria-hidden="true"></i>
                            <span data-theme-toggle-label>Dark</span>
                        </button>
                    </li>
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

    <main id="main" class="container pb-5" tabindex="-1">
        @yield('content')
    </main>

    <script src="https://code.jquery.com/jquery-3.3.1.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/popper.js/1.14.7/umd/popper.min.js" integrity="sha384-UO2eT0CpHqdSJQ6hJty5KVphtPhzWj9WO1clHTMGa3JDZwrnQq4sF86dIHNDz0W1" crossorigin="anonymous"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/moment.js/2.24.0/moment.js"></script>
    <script type="text/javascript" src="https://cdnjs.cloudflare.com/ajax/libs/tempusdominus-bootstrap-4/5.0.0-alpha14/js/tempusdominus-bootstrap-4.min.js"></script>
    <script src="https://stackpath.bootstrapcdn.com/bootstrap/4.3.1/js/bootstrap.min.js" integrity="sha384-JjSmVgyd0p3pXB1rRibZUAYoIIy6OrQ6VrjIEaFf/nJGzIxFDsf4x0xIM+B07jRM" crossorigin="anonymous"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/summernote/0.8.12/summernote-bs4.js"></script>
    <script src="{{ asset('js/clinic-ui.js') }}" defer></script>

    @yield('js')
  </body>
</html>
