{{-- Session flash message. Keeps the legacy contract: `status` truthy = success, otherwise error. Use: @include('components.flash') --}}
@if (session('status') || session('message'))
    <div class="alert {{ session('status') ? 'alert-success' : 'alert-danger' }} cu-flash"
         role="{{ session('status') ? 'status' : 'alert' }}">
        {{ session('message') }}
    </div>
@endif
