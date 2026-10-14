# Fichier de prospects B2B Paris (RGPD)

Construit un tableur des établissements parisiens actifs de 50 salariés et plus (hors administrations), à partir de sources publiques uniquement.

## Lancer

```bash
pip install duckdb openpyxl requests pyarrow
# Recommandé : télécharger d'abord les deux fichiers SIRENE (~2 Go et ~0,6 Go)
#   https://www.data.gouv.fr/fr/datasets/base-sirene-des-entreprises-et-de-leurs-etablissements-siren-siret/
python3 build_prospects.py \
  --etablissements StockEtablissement_utf8.parquet \
  --unites-legales StockUniteLegale_utf8.parquet \
  --contacts contacts_publics.csv --sortie out
```

Résultat : `out/prospects_paris_b2b.xlsx`, avec trois onglets :

- **Prospects** : Entreprise | SIREN | Effectif | NAF | Site | Domaine | Prénom | Nom | Poste | Source | Email public | Email générique, puis des colonnes de contrôle : SIRET, adresse, catégorie juridique, année de l'effectif, sources et statut.
- **Sans information** : les entreprises pour lesquelles ni site, ni contact, ni email générique n'ont été trouvés.
- **Méthodologie & RGPD** : les sources, les filtres et les obligations d'information.

Le script est relançable : l'extraction et les appels réseau sont mis en cache dans `out/`. Options utiles : `--sans-75116`, `--sans-site`, `--sans-generiques`.

## Étapes et sources

| Étape | Source | Remarque |
|---|---|---|
| Établissements | SIRENE StockEtablissement + StockUniteLegale | État `A`, CP 75001–75020 + 75116 (2e code postal du 16e), tranche de l'**établissement** ∈ {21…53}, catégorie juridique hors `7xxx`, établissements non diffusibles exclus |
| Site / Domaine | Wikidata (SIREN `P1616` → site officiel `P856`) | Le domaine est déduit du site web ; ce n'est pas forcément le domaine des emails |
| Email générique | Pages publiques du site (accueil, contact, carrières, mentions légales, équipe) | Même domaine uniquement, préfixes génériques uniquement (rh@, recrutement@, contact@, jobs@…), `robots.txt` respecté, 1 requête/s |
| Contacts nominatifs | **Saisie manuelle** dans `contacts_publics.csv` | Site de l'entreprise, page « équipe », communiqués de presse. La colonne `source` (URL) est obligatoire, sinon la ligne est rejetée. Pas de LinkedIn. Aucun email nominatif deviné |

`contacts_publics.csv` : `siren,prenom,nom,poste,source,email_public,email_generique,date_collecte`. Une ligne par personne. Plusieurs personnes pour un même SIREN donnent plusieurs lignes dans le tableur.

## Rappels RGPD / CNIL (prospection B2B)

- Base légale : intérêt légitime. Documentez la mise en balance.
- Information (art. 14) : dans le premier message, indiquez l'origine des données, la finalité, l'identité du responsable de traitement et le droit d'opposition.
- Email B2B sans consentement préalable : accepté si l'objet du message est en rapport avec la fonction de la personne, avec un lien de désinscription simple.
- Conservation : 3 ans maximum après le dernier contact. Tenez une liste d'opposition.

## Tests

`python3 -m pytest -q tests`. Les tests tournent sur des données synthétiques, fictives.
