# Place TLS certs here for manual HTTPS mode:
#   fullchain.pem
#   privkey.pem
#
# Cert must cover both front and API domains.
# Then run: sudo ./deploy.sh --front-url=YOUR.DOMAIN --back-url=api.YOUR.DOMAIN
#
# Or use Let's Encrypt (public DNS required):
#   sudo ./deploy.sh --auto-https --front-url=YOUR.DOMAIN --back-url=api.YOUR.DOMAIN
