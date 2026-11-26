# Ziki brand guide

The visual source of truth is [the Ziki style guide](./style-guide.md). It defines colours, fonts, corners, buttons, panels, and theme behaviour for the app and public site. This document covers identity, language, and product presentation.

## Identity and language

The Ziki name and mark stay Ziki. Do not replace them with another product's name, logo, or navigation.

| Word | Meaning |
| --- | --- |
| Organisation | The team that owns projects and memberships. |
| Project | One product or repository inside an organisation. |
| Platform | An issue label such as Web or Mobile. |

Use the language of the feature the person is using. Write short headings, a useful subtitle, and actions that describe what happens next. Empty states explain what is missing and how to proceed.

## Visual identity

- One brand accent: Ziki Blue. Small accent text uses the deeper semantic accent token for contrast.
- One text family: Geist. Geist Mono is for code, identifiers, keys, and numerical data.
- Neutral app pages with bordered surface panels, in light and dark themes.
- Flat dark gray primary actions in light mode, blue primary actions in dark mode. Secondary actions are quiet and bordered.
- Panels use the 12px radius; controls use 10px. Actions are not pills by default.
- Red, amber, and green communicate real states rather than decoration.

The exact values, exceptions, and implementation examples belong to [style-guide.md](./style-guide.md). Reuse `components/ui/` and `lib/ui-style.ts`; do not introduce page-level brand variants.

## References and product scope

The Zedu Amp dashboard is a reference for tone and information hierarchy, not a skin to copy. Do not import its purple palette, wordmark, sidebar, component library, or unrelated metrics cards. Existing product workflows and the light/dark theme toggle remain part of Ziki.

Marketing tools, authentication, settings, security, and issue management all use the same visual system. A feature's location does not create a separate brand.
