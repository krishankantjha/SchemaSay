import { NavLink } from "react-router-dom";

import { SchemaSayLogo } from "@/components/brand/SchemaSayLogo";

import { AccountMenu } from "@/components/layout/AccountMenu";

import { MobileNav } from "@/components/layout/MobileNav";

import { NAV_ITEMS } from "@/components/layout/navConfig";

import { CommandPaletteTrigger } from "@/features/command/CommandPaletteTrigger";

import { ConnectionSelect } from "@/features/connections/ConnectionSelect";

import { ThemeToggle } from "@/components/ui/ThemeToggle";

import { useCommandPalette } from "@/features/command/CommandPaletteContext";

import { cn } from "@/lib/utils";



function ShortcutsHint() {

  const { setShortcutsOpen } = useCommandPalette();



  return (

    <button

      type="button"

      onClick={() => setShortcutsOpen(true)}

      title="Keyboard shortcuts"

      aria-label="Keyboard shortcuts"

      className={cn(

        "nav-utility hidden w-[var(--control-height)] min-w-[var(--control-height)] px-0 lg:inline-flex",

        "pressable border-transparent bg-transparent hover:bg-bg-elevated",

      )}

    >

      <span className="text-xs font-semibold" aria-hidden>

        ?

      </span>

    </button>

  );

}



export function TopNav() {

  return (

    <header className="sticky top-0 z-50 shrink-0 border-b border-border-subtle bg-bg-base/92 pt-[env(safe-area-inset-top)] shadow-sm backdrop-blur-md">

      <div className="mx-auto flex h-[var(--space-nav-height)] max-w-[1600px] items-center gap-4 px-[var(--space-layout-x)]">

        {/* Brand + primary navigation */}

        <div className="flex min-w-0 shrink-0 items-center gap-3">

          <MobileNav />



          <NavLink

            to="/ask"

            aria-label="SchemaSay home"

            title="Home"

            className="inline-flex w-fit shrink-0 rounded-[var(--radius-md)] no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--state-focus-ring)]"

          >

            <SchemaSayLogo size="sm" />

          </NavLink>



          <nav className="hidden items-center gap-1 md:flex" aria-label="Main">

            {NAV_ITEMS.map(({ to, label, icon: Icon }) => (

              <NavLink

                key={to}

                to={to}

                end={to === "/ask"}

                className={({ isActive }) =>

                  cn(

                    "nav-link pressable",

                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--state-focus-ring)]",

                    isActive && "nav-link-active",

                  )

                }

              >

                <Icon aria-hidden strokeWidth={2} />

                {label}

              </NavLink>

            ))}

          </nav>

        </div>



        {/* Centered search — fills middle space on desktop */}

        <div className="hidden min-w-0 flex-1 justify-center px-2 md:flex lg:px-6">

          <CommandPaletteTrigger className="w-full max-w-[13rem] lg:max-w-[15rem]" />

        </div>



        {/* Connection + account utilities */}

        <div className="nav-utilities ml-auto shrink-0 md:ml-0">

          <CommandPaletteTrigger compact className="md:hidden" />

          <ConnectionSelect />

          <span className="nav-utility-separator hidden md:block" aria-hidden />

          <div className="nav-utility-group">

            <ShortcutsHint />

            <ThemeToggle />

          </div>

          <AccountMenu />

        </div>

      </div>

    </header>

  );

}

