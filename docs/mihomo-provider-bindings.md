# Bind generated Mihomo nodes to inline providers

Mihomo templates can opt into exact node bindings with
`proxy-providers.<provider>.remnawave.include-proxy-names`. The backend fills each
provider from the nodes generated for the current subscription, preserving that
user's credentials and host visibility rules.

```yaml
remnawave:
  known-proxy-names:
    - Armenia Hysteria2

proxy-providers:
  armenia:
    type: inline
    remnawave:
      include-proxies: true
      include-proxy-names:
        - Armenia Hysteria2
    health-check:
      enable: true
      url: https://www.gstatic.com/generate_204
      interval: 30
      lazy: true

proxy-groups:
  - name: Armenia Hysteria2
    type: select
    use: [armenia]
    hidden: true
    remnawave:
      include-proxies: false

  - name: Proxy
    type: select
    use: [armenia]
    remnawave:
      include-proxies: false

rules:
  - MATCH,Proxy
```

Names match exactly and are case-sensitive. Multiple names are allowed; their
order is preserved and duplicates are removed. `include-proxies: true` is
required with `include-proxy-names`. Without the new directive, existing
provider and template behavior stays unchanged.

Bound nodes are removed from the top-level `proxies` list to avoid constructing
duplicate adapters. To reference a bound node by name in rules or `GLOBAL`,
provide a selector alias such as the hidden `Armenia Hysteria2` group above.
Provider nodes remain directly selectable through a group's `use` list.

When none of a provider's requested nodes is available to the current user:

- The empty provider and references to it in group `use` lists are removed.
- A selector alias named after an unavailable bound node is removed when it
  depends only on that provider.
- Groups left without candidates select `REJECT`, preventing an unintended
  direct connection.
- Routing references to unavailable nodes become `REJECT`. `SUB-RULE` targets
  and rule options such as `no-resolve` are retained.
- Unavailable nodes disappear from `GLOBAL`; newly generated unbound nodes are
  added to it.

The optional root `remnawave.known-proxy-names` lists additional real node names
that can be absent from some users' subscriptions. This lets the backend handle
their static routing references as unavailable nodes. Other unknown references
remain errors so template typos are not silently hidden.

Bindings use node names, so update the template when hosts are renamed. New
unbound hosts stay in top-level `proxies` and `GLOBAL`; existing provider bindings
do not automatically include them.

Run the focused tests with `npm run test:mihomo-providers`.
