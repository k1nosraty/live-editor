<script lang="ts">
  import { ChevronRight } from '@lucide/svelte';
  export interface MenuItem {
    id?: string;
    label: string;
    key?: string;
    items?: MenuItem[];
    disabled?: boolean;
  }
  let {
    menus,
    onaction,
  }: { menus: { label: string; items: MenuItem[] }[]; onaction: (id: string) => void } = $props();
  function activate(id: string) {
    document
      .querySelectorAll('details.menu[open], details.submenu[open]')
      .forEach((n) => n.removeAttribute('open'));
    onaction(id);
  }
</script>

<nav class="menu-bar" aria-label="Application menu">
  {#each menus as menu}<details class="menu">
      <summary>{menu.label}</summary>
      <div class="menu-popup">{@render items(menu.items)}</div>
    </details>{/each}
</nav>
{#snippet items(entries: MenuItem[])}{#each entries as item}{#if item.label === '-'}<hr
      />{:else if item.items}<details class="submenu">
        <summary>{item.label}<ChevronRight size={13} /></summary>
        <div class="menu-popup">{@render items(item.items)}</div>
      </details>{:else}<button disabled={item.disabled} onclick={() => item.id && activate(item.id)}
        ><span>{item.label}</span>{#if item.key}<kbd>{item.key}</kbd>{/if}</button
      >{/if}{/each}{/snippet}
