# Devpost submission draft

**Prize track:** Most Environmentally Impactful (opt in on the submission form)

## Description

**Green Operations helps development teams reduce avoidable CI/CD compute and make sustainability measurable.** A GitLab Duo Agent Platform agent inspects real pipeline evidence, identifies safe opportunities such as dependency reuse or redundant-job elimination, and guides an optimization that preserves required tests and security gates. The project compares equivalent baseline and optimized runs, publishes pipeline evidence, and documents its software boundary, functional unit, SCI methodology, assumptions, and uncertainty.

The interface presents sustainability as an evidence-led engineering discipline rather than a decorative green score. Directly measured data, modeled estimates, and runtime/resource proxies are labeled separately, and missing information remains visible. The goal is to help maintainers improve delivery efficiency while understanding what the available data can, and cannot, prove about environmental impact.

## Before submitting, replace with real figures

- [ ] Optimizations applied: OPT-1 (lockfile-keyed npm cache), OPT-2 (docs-only job rules)
- [ ] Baseline runs: N, median runtime, runner-minutes — links
- [ ] Optimized runs: N, median runtime, runner-minutes — links
- [ ] Runner-minute proxy change: __% (comparable runs only)
- [ ] Jobs avoided for docs-only changes: 3 (secret detection retained)
- [ ] SCI: not calculated — energy input missing (or the documented inputs)
- [ ] Duo agent report link (issue/MR note)
- [ ] Field Notes page URL (GitLab Pages)
- [ ] Demo video (public or unlisted YouTube, < 3 min)
- [ ] MIT license present, repository public

## Checklist against the plan

- Preserve required tests, security checks, release gates — yes (`secret_detection` always; code changes run all jobs)
- Label each value measured / modeled / proxy — yes (`kind` field in evidence and UI tags)
- Never infer CO₂ from runtime — yes (SCI worksheet refuses without inputs)
- Duo agent on the actual Duo Agent Platform — see `docs/DUO_AGENT.md`

## Official references

- https://gitlab-transcend.devpost.com/
- https://gitlab-transcend.devpost.com/resources
- https://contributors.gitlab.com/transcend-hackathon
- https://github.com/Green-Software-Foundation/sci
