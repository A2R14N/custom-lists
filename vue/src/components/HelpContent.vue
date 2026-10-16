<script setup lang="ts">
import AppIcon from "./AppIcon.vue";
</script>

<template>
  <div class="help-content">
    <section>
      <span>01</span>
      <div>
        <h3>Connect your own storage.</h3>
        <p>
          Create a dedicated Upstash Redis database and connect with its REST URL and
          read/write token. Your settings, provider keys, and snapshots live there.
        </p>
      </div>
    </section>
    <section>
      <span>02</span>
      <div>
        <h3>Bring a list. Keep a snapshot.</h3>
        <p>
          Paste a public MDBList, TMDB or WeTrakr link and add that provider’s key when
          asked. Keep the page open during import. Existing Trakt snapshots stay readable
          without a Trakt subscription.
        </p>
      </div>
    </section>
    <section>
      <span>03</span>
      <div>
        <h3>Install once. Make it yours.</h3>
        <p>
          Open the install link in Stremio or copy it into Nuvio. Refresh snapshots when
          you choose. This addon provides catalogs, not playback streams.
        </p>
      </div>
    </section>
    <div class="privacy-warning">
      <AppIcon name="lock" />
      <p>
        <strong>A note on privacy.</strong> Install links encode your database
        credentials; they aren’t encrypted. Credentials pass through the backend, and
        hosting access logs may retain URLs. Use a dedicated database and a trusted host.
        We don’t save credentials in browser storage or use analytics.
      </p>
    </div>
  </div>
</template>
