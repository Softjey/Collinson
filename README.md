# Activity Weather Ranking Service

> TODO: what was built, how to run it, assumptions.

## Known limitations

- **Scores are for the weather grid cell, not for a resort or a beach.** Pass the coordinates of the slope or the
  beach, not of the town. Zermatt (1608 m) has no snow in October, while Klein Matterhorn (3747 m) has good
  skiing. `ScoredLocation.elevation` in the response shows the elevation the score was calculated for.
- **Waves come from the nearest sea cell**, which can be 5 to 10 km from the requested point, not from a
  specific beach.
