/* Cosmic Address — catalogs and narrative.
 * Positions are approximate (good to a fraction of a degree), which is plenty
 * for a map of this kind. RA in hours, Dec in degrees, distances in light-years
 * unless noted.
 */
(function () {
  'use strict';
  const CA = window.CA;

  // ------------------------------------------------------------------ bright & famous stars
  // [name, RA h, Dec deg, V mag, distance ly, spectral type, label priority 0..3 (3 = always)]
  CA.BRIGHT_STARS = [
    ['Sirius', 6.7525, -16.716, -1.46, 8.6, 'A1V', 3],
    ['Canopus', 6.3992, -52.696, -0.74, 310, 'F0II', 3],
    ['Rigil Kentaurus', 14.6601, -60.834, -0.01, 4.37, 'G2V', 3],
    ['Toliman', 14.66, -60.838, 1.33, 4.37, 'K1V', 1],
    ['Arcturus', 14.2612, 19.182, -0.05, 36.7, 'K1.5III', 3],
    ['Vega', 18.6156, 38.784, 0.03, 25.0, 'A0V', 3],
    ['Capella', 5.2782, 45.998, 0.08, 42.9, 'G3III', 3],
    ['Rigel', 5.2423, -8.202, 0.13, 860, 'B8Ia', 3],
    ['Procyon', 7.655, 5.225, 0.34, 11.46, 'F5IV', 3],
    ['Achernar', 1.6286, -57.237, 0.46, 139, 'B6V', 2],
    ['Betelgeuse', 5.9195, 7.407, 0.5, 548, 'M1Ia', 3],
    ['Hadar', 14.0637, -60.373, 0.61, 390, 'B1III', 2],
    ['Altair', 19.8464, 8.868, 0.76, 16.7, 'A7V', 3],
    ['Acrux', 12.4433, -63.099, 0.76, 320, 'B0.5IV', 2],
    ['Aldebaran', 4.5987, 16.509, 0.86, 65.3, 'K5III', 3],
    ['Antares', 16.4901, -26.432, 0.96, 550, 'M1.5Iab', 3],
    ['Spica', 13.4199, -11.161, 0.97, 250, 'B1V', 2],
    ['Pollux', 7.7553, 28.026, 1.14, 33.8, 'K0III', 2],
    ['Fomalhaut', 22.9608, -29.622, 1.16, 25.1, 'A3V', 2],
    ['Deneb', 20.6905, 45.28, 1.25, 2600, 'A2Ia', 3],
    ['Mimosa', 12.7954, -59.689, 1.25, 280, 'B0.5III', 1],
    ['Regulus', 10.1395, 11.967, 1.4, 79.3, 'B8IV', 2],
    ['Adhara', 6.9771, -28.972, 1.5, 430, 'B2II', 1],
    ['Castor', 7.5767, 31.888, 1.58, 51, 'A1V', 2],
    ['Gacrux', 12.5194, -57.113, 1.63, 88.6, 'M3.5III', 1],
    ['Shaula', 17.5601, -37.104, 1.62, 570, 'B2IV', 1],
    ['Bellatrix', 5.4189, 6.35, 1.64, 250, 'B2III', 1],
    ['Elnath', 5.4382, 28.608, 1.65, 134, 'B7III', 1],
    ['Miaplacidus', 9.22, -69.717, 1.69, 113, 'A1III', 1],
    ['Alnilam', 5.6036, -1.202, 1.69, 2000, 'B0Ia', 1],
    ['Alnair', 22.1372, -46.961, 1.74, 101, 'B6V', 0],
    ['Alnitak', 5.6793, -1.943, 1.77, 1260, 'O9.5Ib', 1],
    ['Alioth', 12.9005, 55.96, 1.77, 82.6, 'A1III', 1],
    ['Dubhe', 11.0621, 61.751, 1.79, 123, 'K0III', 1],
    ['Mirfak', 3.4054, 49.861, 1.79, 510, 'F5Ib', 0],
    ['Wezen', 7.1399, -26.393, 1.83, 1600, 'F8Ia', 0],
    ['Sargas', 17.622, -42.998, 1.86, 300, 'F0II', 0],
    ['Kaus Australis', 18.4029, -34.385, 1.85, 143, 'B9.5III', 0],
    ['Avior', 8.3752, -59.51, 1.86, 630, 'K3III', 0],
    ['Alkaid', 13.7923, 49.313, 1.86, 104, 'B3V', 0],
    ['Menkalinan', 5.9921, 44.948, 1.9, 81, 'A1IV', 0],
    ['Atria', 16.8111, -69.028, 1.91, 391, 'K2II', 0],
    ['Alhena', 6.6285, 16.399, 1.92, 109, 'A1IV', 0],
    ['Peacock', 20.4275, -56.735, 1.94, 179, 'B2IV', 0],
    ['Alsephina', 8.7451, -54.709, 1.96, 80.6, 'A1V', 0],
    ['Mirzam', 6.3783, -17.956, 1.98, 490, 'B1II', 0],
    ['Alphard', 9.4598, -8.659, 1.98, 180, 'K3II', 0],
    ['Polaris', 2.5302, 89.264, 1.98, 433, 'F7Ib', 3],
    ['Hamal', 2.1196, 23.463, 2.0, 66, 'K2III', 0],
    ['Algieba', 10.3329, 19.842, 2.08, 130, 'K0III', 0],
    ['Diphda', 0.7265, -17.987, 2.02, 96, 'K0III', 0],
    ['Nunki', 18.9211, -26.297, 2.05, 228, 'B2.5V', 0],
    ['Menkent', 14.1114, -36.37, 2.06, 59, 'K0III', 0],
    ['Mirach', 1.1622, 35.621, 2.05, 197, 'M0III', 0],
    ['Alpheratz', 0.1398, 29.091, 2.06, 97, 'B8IV', 0],
    ['Rasalhague', 17.5822, 12.56, 2.07, 49, 'A5III', 0],
    ['Kochab', 14.8451, 74.156, 2.08, 131, 'K4III', 0],
    ['Saiph', 5.7959, -9.67, 2.09, 650, 'B0.5Ia', 0],
    ['Denebola', 11.8177, 14.572, 2.14, 36, 'A3V', 0],
    ['Algol', 3.1361, 40.956, 2.12, 90, 'B8V', 1],
    ['Tiaki', 22.7111, -46.885, 2.07, 177, 'M5III', 0],
    ['Mintaka', 5.5334, -0.299, 2.23, 1200, 'O9.5II', 0],
    ['Schedar', 0.6751, 56.537, 2.24, 228, 'K0III', 0],
    ['Caph', 0.1529, 59.15, 2.28, 54.7, 'F2III', 0],
    ['Merak', 11.0307, 56.382, 2.37, 79.7, 'A1V', 0],
    ['Phecda', 11.8972, 53.695, 2.44, 83.2, 'A0V', 0],
    ['Megrez', 12.2571, 57.033, 3.31, 80.5, 'A3V', 0],
    ['Mizar', 13.3987, 54.925, 2.23, 82.9, 'A2V', 0],
    ['Navi', 0.9451, 60.717, 2.47, 550, 'B0.5IV', 0],
    ['Ruchbah', 1.4302, 60.235, 2.68, 99, 'A5III', 0],
    ['Segin', 1.9066, 63.67, 3.37, 410, 'B3III', 0],
    ['Sadr', 20.3705, 40.257, 2.23, 1800, 'F8Ib', 0],
    ['Albireo', 19.512, 27.96, 3.08, 430, 'K3II', 0],
    ['Aljanah', 20.7702, 33.97, 2.48, 72, 'K0III', 0],
    ['Fawaris', 19.7496, 45.131, 2.87, 165, 'B9.5III', 0],
    ['Enif', 21.7364, 9.875, 2.39, 690, 'K2Ib', 0],
    ['Scheat', 23.0629, 28.083, 2.42, 196, 'M2.5II', 0],
    ['Markab', 23.0794, 15.205, 2.49, 133, 'B9III', 0],
    ['Algenib', 0.2206, 15.184, 2.83, 390, 'B2IV', 0],
    ['Dschubba', 16.0056, -22.622, 2.29, 490, 'B0.3IV', 0],
    ['Larawag', 16.8361, -34.293, 2.29, 64, 'K1III', 0],
    ['Lesath', 17.5127, -37.296, 2.7, 580, 'B2IV', 0],
    ['Kaus Media', 18.3499, -29.828, 2.7, 350, 'K3III', 0],
    ['Kaus Borealis', 18.4662, -25.422, 2.81, 78, 'K1III', 0],
    ['Ascella', 19.0435, -29.88, 2.6, 88, 'A2III', 0],
    ['Alnasl', 18.0968, -30.424, 2.98, 97, 'K0III', 0],
    ['Tarazed', 19.771, 10.613, 2.72, 395, 'K3II', 0],
    ['Eltanin', 17.9434, 51.489, 2.24, 154, 'K5III', 0],
    ['Rastaban', 17.5072, 52.301, 2.79, 380, 'G2II', 0],
    ['Thuban', 14.0731, 64.376, 3.65, 303, 'A0III', 0],
    ['Izar', 14.7498, 27.074, 2.37, 202, 'K0II', 0],
    ['Muphrid', 13.9114, 18.398, 2.68, 37, 'G0IV', 0],
    ['Alphecca', 15.5781, 26.715, 2.23, 75, 'A0V', 0],
    ['Unukalhai', 15.7378, 6.426, 2.63, 74, 'K2III', 0],
    ['Kornephoros', 16.5037, 21.49, 2.77, 139, 'G7III', 0],
    ['Sabik', 17.173, -15.725, 2.43, 88, 'A2V', 0],
    ['Menkar', 3.038, 4.09, 2.54, 250, 'M1.5III', 0],
    ['Almach', 2.065, 42.33, 2.26, 350, 'K3II', 0],
    ['Alcyone', 3.7914, 24.105, 2.87, 444, 'B7III', 0],
    ['Zubenelgenubi', 14.848, -16.042, 2.75, 76, 'A3IV', 0],
    ['Zubeneschamali', 15.2835, -9.383, 2.61, 185, 'B8V', 0],
    ['Gienah', 12.2634, -17.542, 2.59, 154, 'B8III', 0],
    ['Kraz', 12.5731, -23.397, 2.65, 140, 'G5II', 0],
    ['Algorab', 12.4977, -16.515, 2.95, 87, 'B9V', 0],
    ['Porrima', 12.6943, -1.449, 2.74, 38, 'F0V', 0],
    ['Vindemiatrix', 13.0364, 10.959, 2.83, 110, 'G8III', 0],
    ['Cor Caroli', 12.9338, 38.318, 2.89, 115, 'A0V', 0],
    ['Aludra', 7.4016, -29.303, 2.45, 2000, 'B5Ia', 0],
    ['Naos', 8.0598, -40.003, 2.21, 1080, 'O4I', 0],
    ['Suhail', 9.1333, -43.433, 2.21, 545, 'K4Ib', 0],
    ['Aspidiske', 9.2848, -59.275, 2.21, 690, 'A8Ib', 0],
    ['Regor', 8.1589, -47.337, 1.83, 1120, 'O7.5III', 0],
    ['Imai', 12.2524, -58.749, 2.79, 345, 'B2IV', 0],
    ['Epsilon Centauri', 13.6647, -53.466, 2.3, 430, 'B1III', 0],
    ['Ankaa', 0.4381, -42.306, 2.4, 85, 'K0III', 0],
    ['Arneb', 5.5456, -17.822, 2.58, 2200, 'F0Ib', 0],
    ['Nihal', 5.4707, -20.759, 2.84, 160, 'G5II', 0],
    ['Meissa', 5.5856, 9.934, 3.39, 1100, 'O8III', 0],
    ['Hatysa', 5.5905, -5.91, 2.77, 1340, 'O9III', 0],
    ['Tabit', 4.8307, 6.961, 3.19, 26, 'F6V', 0],
    ['Alderamin', 21.3097, 62.585, 2.45, 49, 'A8V', 0],
    ['Sheratan', 1.9107, 20.808, 2.64, 59.6, 'A5V', 0],
    ['Zosma', 11.2351, 20.524, 2.56, 58, 'A4V', 0],
    ['Sadalsuud', 21.526, -5.571, 2.87, 540, 'G0Ib', 0],
    ['Sadalmelik', 22.0964, -0.32, 2.94, 520, 'G2Ib', 0],
    ['Deneb Algedi', 21.784, -16.127, 2.85, 39, 'A5V', 0],
    ['Acamar', 2.971, -40.305, 2.88, 161, 'A3IV', 0],
    ['Zaurak', 3.9672, -13.509, 2.95, 203, 'M1III', 0],
    ['Cursa', 5.1308, -5.086, 2.78, 89, 'A3III', 0],
    ['Phact', 5.6609, -34.074, 2.65, 261, 'B7IV', 0],
    ['Alpha Tucanae', 22.3083, -60.26, 2.86, 199, 'K3III', 0],
    ['Beta Hydri', 0.429, -77.254, 2.8, 24.3, 'G2IV', 0],
    ['Alpha Hydri', 1.9796, -61.57, 2.86, 71.8, 'F0V', 0],
    // Fainter members that complete the constellation figures below.
    ['Acrab', 16.0906, -19.805, 2.62, 400, 'B0.5V', 0],
    ['Fang', 15.9809, -26.114, 2.89, 590, 'B1V', 0],
    ['Alniyat', 16.3531, -25.593, 2.89, 700, 'B1III', 0],
    ['Paikauhale', 16.598, -28.216, 2.82, 470, 'B0V', 0],
    ['Xamidimura', 16.8645, -38.047, 3.08, 500, 'B1.5V', 0],
    ['Zeta Scorpii', 16.9097, -42.361, 3.62, 132, 'K4III', 0],
    ['Eta Scorpii', 17.2026, -43.239, 3.33, 73, 'F2V', 0],
    ['Girtab', 17.7081, -39.03, 2.39, 480, 'B1.5III', 0],
    ['Iota Scorpii', 17.7931, -40.127, 2.99, 1900, 'F2Ia', 0],
    ['Chertan', 11.2373, 15.429, 3.33, 165, 'A2V', 0],
    ['Adhafera', 10.2782, 23.417, 3.43, 274, 'F0III', 0],
    ['Rasalas', 9.8794, 26.007, 3.88, 124, 'K2III', 0],
    ['Algenubi', 9.7642, 23.774, 2.98, 247, 'G1II', 0],
    ['Eta Leonis', 10.1222, 16.763, 3.48, 1300, 'A0Ib', 0],
    ['Pherkad', 15.3455, 71.834, 3.0, 487, 'A3II', 0],
    ['Yildun', 17.5369, 86.586, 4.35, 172, 'A1V', 0],
    ['Epsilon Ursae Minoris', 16.7662, 82.037, 4.21, 347, 'G5III', 0],
    ['Zeta Ursae Minoris', 15.7343, 77.794, 4.29, 370, 'A3V', 0],
    ['Eta Ursae Minoris', 16.2918, 75.755, 4.95, 97, 'F5V', 0],
    ['Sheliak', 18.8347, 33.363, 3.52, 960, 'B7II', 0],
    ['Sulafat', 18.9824, 32.69, 3.25, 620, 'B9III', 0],
    ['Delta Lyrae', 18.9084, 36.899, 4.3, 740, 'M4II', 0],
    ['Zeta Lyrae', 18.7462, 37.605, 4.36, 150, 'A4m', 0],
    ['Alshain', 19.9219, 6.407, 3.71, 45, 'G8IV', 0],
    ['Delta Aquilae', 19.425, 3.115, 3.36, 50, 'F2IV', 0],
    ['Okab', 19.0902, 13.863, 2.99, 83, 'A0V', 0],
    ['Lambda Aquilae', 19.1041, -4.883, 3.43, 125, 'B9V', 0],
    ['Seginus', 14.5346, 38.308, 3.03, 85, 'A7III', 0],
    ['Nekkar', 15.0324, 40.391, 3.49, 225, 'G8III', 0],
    ['Delta Bootis', 15.2584, 33.315, 3.47, 122, 'G8III', 0],
    ['Rho Bootis', 14.5305, 30.371, 3.58, 149, 'K3III', 0],
    ['Phi Sagittarii', 18.7609, -26.991, 3.17, 230, 'B8III', 0],
    ['Tau Sagittarii', 19.1157, -27.67, 3.32, 120, 'K1III', 0],
    ['Hassaleh', 4.9499, 33.166, 2.69, 490, 'K3II', 0],
    ['Mahasim', 5.9954, 37.212, 2.62, 166, 'A0p', 0],
    ['Mebsuta', 6.7322, 25.131, 2.98, 840, 'G8Ib', 0],
    ['Wasat', 7.3354, 21.982, 3.53, 60, 'F0IV', 0],
    ['Tejat', 6.3827, 22.514, 2.87, 230, 'M3III', 0],
    ['Furud', 6.3386, -30.063, 3.02, 362, 'B2.5V', 0],
    ['Gomeisa', 7.4525, 8.289, 2.89, 160, 'B8V', 0],
    ['Minkar', 12.1687, -22.62, 3.0, 318, 'K2III', 0],
  ];

  // Stick figures joining the stars above (by name). Seen from the Sun they are the
  // familiar shapes; seen from anywhere else they come apart, because their stars
  // lie at very different distances.
  CA.CONSTELLATIONS = [
    ['Orion', [['Betelgeuse', 'Meissa', 'Bellatrix'], ['Betelgeuse', 'Alnitak', 'Alnilam', 'Mintaka', 'Bellatrix'], ['Alnitak', 'Saiph'], ['Mintaka', 'Rigel']]],
    ['Ursa Major', [['Alkaid', 'Mizar', 'Alioth', 'Megrez', 'Phecda', 'Merak', 'Dubhe', 'Megrez']]],
    ['Ursa Minor', [['Polaris', 'Yildun', 'Epsilon Ursae Minoris', 'Zeta Ursae Minoris', 'Kochab', 'Pherkad', 'Eta Ursae Minoris', 'Zeta Ursae Minoris']]],
    ['Cassiopeia', [['Caph', 'Schedar', 'Navi', 'Ruchbah', 'Segin']]],
    ['Cygnus', [['Deneb', 'Sadr', 'Albireo'], ['Aljanah', 'Sadr', 'Fawaris']]],
    ['Lyra', [['Vega', 'Zeta Lyrae', 'Delta Lyrae', 'Sulafat', 'Sheliak', 'Zeta Lyrae']]],
    ['Aquila', [['Tarazed', 'Altair', 'Alshain'], ['Altair', 'Delta Aquilae', 'Lambda Aquilae'], ['Delta Aquilae', 'Okab']]],
    ['Leo', [['Regulus', 'Eta Leonis', 'Algieba', 'Adhafera', 'Rasalas', 'Algenubi'], ['Algieba', 'Zosma', 'Denebola', 'Chertan', 'Regulus'], ['Zosma', 'Chertan']]],
    ['Scorpius', [['Acrab', 'Dschubba', 'Fang'], ['Dschubba', 'Alniyat', 'Antares', 'Paikauhale', 'Larawag', 'Xamidimura', 'Zeta Scorpii', 'Eta Scorpii', 'Sargas', 'Iota Scorpii', 'Girtab', 'Shaula', 'Lesath']]],
    ['Sagittarius', [['Alnasl', 'Kaus Media', 'Kaus Borealis', 'Phi Sagittarii', 'Kaus Media', 'Kaus Australis', 'Alnasl'], ['Kaus Australis', 'Ascella', 'Phi Sagittarii', 'Nunki', 'Tau Sagittarii', 'Ascella']]],
    ['Crux', [['Acrux', 'Gacrux'], ['Mimosa', 'Imai']]],
    ['Canis Major', [['Mirzam', 'Sirius', 'Wezen', 'Aludra'], ['Wezen', 'Adhara', 'Furud']]],
    ['Canis Minor', [['Procyon', 'Gomeisa']]],
    ['Gemini', [['Castor', 'Pollux'], ['Castor', 'Mebsuta', 'Tejat'], ['Pollux', 'Wasat', 'Alhena']]],
    ['Auriga', [['Capella', 'Menkalinan', 'Mahasim', 'Elnath', 'Hassaleh', 'Capella']]],
    ['Boötes', [['Arcturus', 'Izar', 'Delta Bootis', 'Nekkar', 'Seginus', 'Rho Bootis', 'Arcturus'], ['Arcturus', 'Muphrid']]],
    ['Pegasus', [['Markab', 'Scheat', 'Alpheratz', 'Algenib', 'Markab']]],
    ['Andromeda', [['Alpheratz', 'Mirach', 'Almach']]],
    ['Corvus', [['Gienah', 'Algorab', 'Kraz', 'Minkar', 'Gienah']]],
    ['Centaurus', [['Rigil Kentaurus', 'Hadar']]],
  ];

  // ------------------------------------------------------------------ nearby & famous faint stars
  // [name, RA h, Dec deg, V mag, distance ly, spectral type, note]
  CA.NEAR_STARS = [
    ['Proxima Centauri', 14.4953, -62.679, 11.13, 4.246, 'M5.5V', 'Closest star to the Sun · has a planet in its habitable zone'],
    ["Barnard's Star", 17.9634, 4.693, 9.51, 5.96, 'M4V', 'Fastest-moving star in our sky'],
    ['Luhman 16', 10.8161, -53.319, 23.0, 6.5, 'L8', 'Pair of brown dwarfs'],
    ['Wolf 359', 10.9414, 7.014, 13.51, 7.86, 'M6V', ''],
    ['Lalande 21185', 11.0555, 35.97, 7.52, 8.31, 'M2V', ''],
    ['UV Ceti', 1.6503, -17.95, 12.5, 8.73, 'M5.5V', 'Flare star pair'],
    ['Ross 154', 18.8304, -23.836, 10.4, 9.69, 'M3.5V', ''],
    ['Ross 248', 23.6986, 44.167, 12.3, 10.3, 'M5.5V', ''],
    ['Epsilon Eridani', 3.5488, -9.458, 3.73, 10.5, 'K2V', 'Young star with a dusty disk'],
    ['Lacaille 9352', 23.0978, -35.853, 7.34, 10.74, 'M0.5V', ''],
    ['Ross 128', 11.7957, 0.804, 11.1, 11.0, 'M4V', ''],
    ['EZ Aquarii', 22.6425, -15.3, 13.0, 11.1, 'M5V', ''],
    ['61 Cygni', 21.1152, 38.749, 5.2, 11.4, 'K5V', 'First star to have its distance measured (1838)'],
    ['Struve 2398', 18.7131, 59.628, 8.9, 11.5, 'M3V', ''],
    ['Groombridge 34', 0.3065, 44.023, 8.1, 11.6, 'M1.5V', ''],
    ['Epsilon Indi', 22.0561, -56.786, 4.69, 11.9, 'K5V', ''],
    ['DX Cancri', 8.497, 26.78, 14.8, 11.8, 'M6.5V', ''],
    ['Tau Ceti', 1.7345, -15.937, 3.5, 11.9, 'G8V', 'Nearest single Sun-like star'],
    ['GJ 1061', 3.6, -44.513, 13.0, 12.0, 'M5.5V', ''],
    ['YZ Ceti', 1.2086, -16.998, 12.1, 12.1, 'M4.5V', ''],
    ["Luyten's Star", 7.4568, 5.227, 9.9, 12.4, 'M3.5V', ''],
    ["Teegarden's Star", 2.8836, 16.883, 15.1, 12.5, 'M7V', ''],
    ["Kapteyn's Star", 5.1947, -45.019, 8.85, 12.8, 'M1.5V', ''],
    ['Lacaille 8760', 21.2903, -38.867, 6.67, 12.9, 'M0V', ''],
    ['Kruger 60', 22.4664, 57.697, 9.6, 13.1, 'M3V', ''],
    ['Ross 614', 6.4898, -2.814, 11.2, 13.4, 'M4.5V', ''],
    ['Wolf 1061', 16.5052, -12.667, 10.1, 14.0, 'M3V', ''],
    ["Van Maanen's Star", 0.8194, 5.389, 12.4, 14.1, 'DZ', 'Nearest solitary white dwarf'],
    ['Gliese 1', 0.0903, -37.35, 8.6, 14.2, 'M1.5V', ''],
    ['Gliese 876', 22.8977, -14.263, 10.2, 15.2, 'M4V', ''],
    ['Gliese 832', 21.5555, -49.009, 8.7, 16.2, 'M1.5V', ''],
    ['40 Eridani', 4.2536, -7.653, 4.43, 16.3, 'K0V', 'Triple star · home of fictional Vulcan'],
    ['70 Ophiuchi', 18.0925, 2.5, 4.03, 16.6, 'K0V', ''],
    ['Sigma Draconis', 19.541, 69.661, 4.67, 18.8, 'K0V', ''],
    ['Eta Cassiopeiae', 0.8183, 57.816, 3.44, 19.4, 'G0V', ''],
    ['82 Eridani', 3.3276, -43.07, 4.25, 19.7, 'G8V', ''],
    ['Delta Pavonis', 20.1453, -66.182, 3.55, 19.9, 'G8IV', ''],
    ['Gliese 581', 15.3237, -7.722, 10.6, 20.5, 'M3V', 'Hosts a multi-planet system'],
    ['HD 219134', 23.2372, 57.168, 5.57, 21.3, 'K3V', ''],
    ['Gliese 667 C', 17.3099, -34.999, 10.2, 23.6, 'M1.5V', ''],
    ['TRAPPIST-1', 23.1083, -5.041, 18.8, 40.7, 'M8V', 'Seven Earth-sized planets'],
    ['51 Pegasi', 22.9577, 20.769, 5.49, 50.6, 'G2IV', 'First planet found around a Sun-like star (1995)'],
  ];

  // ------------------------------------------------------------------ clusters & nebulae (stellar-neighborhood layer)
  // [name, RA h, Dec deg, distance ly, radius ly, kind, color [r,g,b], label note]
  CA.NEBULAE = [
    ['Hyades', 4.45, 15.87, 153, 9, 'cluster', [1.0, 0.86, 0.66], 'Nearest open cluster'],
    ['Pleiades', 3.79, 24.117, 444, 7, 'cluster', [0.62, 0.78, 1.0], 'The Seven Sisters'],
    ['Beehive Cluster', 8.667, 19.98, 577, 7, 'cluster', [1.0, 0.92, 0.8], ''],
    ['Rho Ophiuchi Cloud', 16.43, -23.45, 460, 12, 'nebula', [1.0, 0.72, 0.42], 'Nearest star-forming region'],
    ['Helix Nebula', 22.494, -20.837, 655, 1.4, 'planetary', [0.45, 0.95, 0.9], 'A dying Sun-like star'],
    ['Coalsack', 12.85, -62.5, 600, 30, 'dark', [0.5, 0.6, 0.7], 'Dark nebula'],
    ['Taurus Molecular Cloud', 4.5, 26.0, 450, 35, 'dark', [0.5, 0.6, 0.7], ''],
    ['Orion Nebula', 5.588, -5.39, 1344, 12, 'emission', [1.0, 0.42, 0.62], 'Stellar nursery visible to the naked eye'],
    ['Orion Molecular Cloud', 5.6, -3.0, 1400, 60, 'emission', [0.9, 0.35, 0.5], ''],
    ['Veil Nebula', 20.75, 30.72, 2400, 55, 'remnant', [0.5, 0.8, 1.0], 'Supernova remnant'],
    ['North America Nebula', 20.98, 44.33, 2590, 45, 'emission', [1.0, 0.35, 0.45], ''],
    ['Ring Nebula', 18.893, 33.03, 2300, 1.3, 'planetary', [0.55, 0.95, 0.85], ''],
    ['Lagoon Nebula', 18.063, -24.38, 4100, 55, 'emission', [1.0, 0.4, 0.55], ''],
    ['Eagle Nebula', 18.313, -13.78, 5700, 35, 'emission', [1.0, 0.55, 0.45], 'Pillars of Creation'],
    ['Crab Nebula', 5.575, 22.015, 6500, 5.5, 'remnant', [0.7, 0.85, 1.0], 'Supernova seen in 1054'],
    ['Carina Nebula', 10.73, -59.87, 7500, 120, 'emission', [1.0, 0.5, 0.4], ''],
    ['Double Cluster', 2.33, 57.13, 7500, 30, 'cluster', [0.7, 0.8, 1.0], ''],
  ];

  // ------------------------------------------------------------------ spacecraft (2026 positions, approximate)
  // [name, RA h, Dec deg, distance AU, note]
  CA.SPACECRAFT = [
    ['Voyager 1', 17.22, 12.0, 168, 'Farthest human-made object · launched 1977'],
    ['Voyager 2', 20.2, -59.4, 141, 'Only visitor to Uranus and Neptune'],
    ['New Horizons', 19.2, -20.6, 64, 'Flew past Pluto in 2015'],
  ];

  // ------------------------------------------------------------------ Local Group
  // [name, galactic l, b (deg), distance Mly, size kly (diameter), kind, label priority]
  CA.LOCAL_GROUP = [
    ['Sagittarius Dwarf', 5.6, -14.2, 0.065, 10, 'dsph', 1],
    ['Ursa Minor Dwarf', 104.97, 44.8, 0.2, 2, 'dsph', 0],
    ['Draco Dwarf', 86.37, 34.72, 0.26, 2, 'dsph', 0],
    ['Sculptor Dwarf', 287.53, -83.16, 0.29, 3, 'dsph', 0],
    ['Sextans Dwarf', 243.5, 42.27, 0.28, 3, 'dsph', 0],
    ['Carina Dwarf', 260.11, -22.22, 0.33, 2, 'dsph', 0],
    ['Fornax Dwarf', 237.1, -65.65, 0.46, 5, 'dsph', 1],
    ['Leo II', 220.17, 67.23, 0.69, 2, 'dsph', 0],
    ['Leo I', 225.99, 49.11, 0.82, 3, 'dsph', 0],
    ['Phoenix Dwarf', 272.16, -68.95, 1.44, 2, 'dirr', 0],
    ["Barnard's Galaxy", 25.34, -18.4, 1.63, 7, 'dirr', 1],
    ['IC 10', 118.97, -3.33, 2.2, 5, 'dirr', 0],
    ['IC 1613', 129.73, -60.58, 2.38, 10, 'dirr', 0],
    ['Cetus Dwarf', 101.44, -72.86, 2.46, 3, 'dsph', 0],
    ['Leo A', 196.9, 52.42, 2.6, 4, 'dirr', 0],
    ['Tucana Dwarf', 322.91, -47.37, 2.87, 2, 'dsph', 0],
    ['Pegasus Dwarf', 94.77, -43.55, 3.0, 4, 'dirr', 0],
    ['Wolf-Lundmark-Melotte', 75.86, -73.62, 3.04, 8, 'dirr', 0],
    ['Aquarius Dwarf', 34.05, -31.35, 3.2, 2, 'dirr', 0],
    ['Sagittarius Dwarf Irregular', 21.06, -16.28, 3.4, 2, 'dirr', 0],
    ['NGC 3109', 262.1, 23.07, 4.3, 25, 'dirr', 0],
    ['Sextans A', 246.15, 39.88, 4.3, 5, 'dirr', 0],
    ['Antlia Dwarf', 263.1, 22.3, 4.3, 2, 'dsph', 0],
  ];
  // Andromeda and Triangulum get full particle models.
  CA.M31 = { l: 121.17, b: -21.57, d: 2.537, incl: 77, pa: 38, raH: 0.7123, dec: 41.269 };
  CA.M33 = { l: 133.61, b: -31.33, d: 2.73, incl: 54, pa: 23, raH: 1.5641, dec: 30.66 };

  // ------------------------------------------------------------------ Laniakea & neighbors
  // [name, galactic l, b, distance Mly, member count (weight), radius Mly, in Laniakea?, label priority]
  CA.CLUSTERS = [
    ['Virgo Cluster', 283.8, 74.5, 54, 1500, 7, true, 3],
    ['Fornax Cluster', 236.7, -53.6, 62, 250, 3.5, true, 2],
    ['Eridanus Group', 208.0, -48.0, 75, 150, 4, true, 0],
    ['Centaurus Cluster', 302.4, 21.6, 170, 600, 6, true, 2],
    ['Hydra Cluster', 269.6, 26.5, 160, 400, 5, true, 2],
    ['Antlia Cluster', 273.0, 19.0, 130, 200, 4, true, 0],
    ['Norma Cluster', 325.3, -7.3, 220, 900, 7, true, 3],
    ['Pavo-Indus Supercluster', 338.0, -32.0, 200, 500, 14, true, 1],
    ['Leo II Groups', 225.0, 60.0, 80, 150, 6, true, 0],
    ['M81 Group', 142.1, 40.9, 12, 40, 1.2, true, 0],
    ['Centaurus A Group', 309.5, 19.4, 13, 40, 1.5, true, 0],
    ['Sculptor Group', 97.0, -88.0, 12, 30, 1.5, true, 0],
    ['Coma Cluster', 58.1, 88.0, 321, 1200, 8, false, 2],
    ['Perseus Cluster', 150.6, -13.3, 240, 900, 7, false, 1],
    ['Perseus–Pisces Supercluster', 140.0, -25.0, 250, 1400, 22, false, 2],
    ['Shapley Supercluster', 312.0, 30.0, 650, 2600, 35, false, 2],
    ['Hercules Supercluster', 31.0, 45.0, 500, 900, 25, false, 0],
  ];
  // The Great Attractor sits near the Norma Cluster.
  CA.GREAT_ATTRACTOR = { l: 320.0, b: 0.0, d: 200 };

  // Famous galaxies beyond the Local Group.
  // [name, RA h, Dec deg, distance Mly, kind, note]
  CA.GALAXIES = [
    ['M87', 12.5137, 12.391, 53.5, 'elliptical', 'Its black hole was the first ever photographed'],
    ['Sombrero Galaxy', 12.6665, -11.623, 31, 'spiral', ''],
    ['Whirlpool Galaxy', 13.498, 47.195, 28, 'spiral', ''],
    ['Pinwheel Galaxy', 14.0535, 54.349, 21, 'spiral', ''],
    ['Centaurus A', 13.4243, -43.019, 12.4, 'elliptical', 'Radio jets a million light-years long'],
    ["Bode's Galaxy", 9.9258, 69.065, 11.8, 'spiral', ''],
    ['Cigar Galaxy', 9.931, 69.68, 11.4, 'starburst', 'Forming stars ten times faster than the Milky Way'],
    ['Sculptor Galaxy', 0.7925, -25.288, 11.4, 'spiral', ''],
    ['Southern Pinwheel', 13.6169, -29.866, 15, 'spiral', ''],
    ['Black Eye Galaxy', 12.9456, 21.683, 17.3, 'spiral', ''],
  ];

  // ------------------------------------------------------------------ narrative
  // z = log10 of camera distance to focus (meters). addr = line for the cosmic address;
  // at = the chapter whose address line stays lit here. Sorted by z, smallest first.
  CA.CHAPTERS = [
    {
      id: 'planck', z: -34.35, title: 'Planck Length', addr: '…', speculative: true, end: true,
      text: 'At 1.6 × 10⁻³⁵ m, gravity and quantum physics collide. Space itself may froth into a foam, or be woven from strings or loops. No one knows. The map ends here too.',
    },
    {
      id: 'uncharted', z: -19.3, title: 'Uncharted', kicker: 'Beyond measurement', at: 'planck', end: true,
      text: 'The Large Hadron Collider finds no structure down to about 10⁻¹⁹ m: quarks and electrons still look like points. No experiment has ever seen anything smaller.',
    },
    {
      id: 'proton', z: -14.6, title: 'Proton', addr: 'Proton',
      text: 'Two up quarks and a down quark, bound by gluons in a seething sea of particles that flicker in and out of existence. Only about 1% of the proton’s mass is the quarks themselves; the rest is energy.',
    },
    {
      id: 'nucleus', z: -13.85, title: 'Carbon Nucleus', addr: 'Nucleus',
      text: 'Six protons and six neutrons, held by the strongest force in nature. If the atom were a stadium, its nucleus would be a pea at the center, yet it carries 99.97% of the atom’s mass.',
    },
    {
      id: 'atom', z: -9.4, title: 'Carbon Atom', addr: 'Carbon atom',
      text: 'Six electrons: not tiny planets in orbit but a cloud of probability a few tenths of a nanometer across. Every living thing is built around carbon.',
    },
    {
      id: 'dna', z: -7.7, title: 'DNA', addr: 'DNA',
      text: 'Each of your cells packs two meters of DNA, wound around protein spools called histones. The double helix is two nanometers wide and spells out your genome in four letters.',
    },
    {
      id: 'cell', z: -4.3, title: 'Cell', addr: 'Cell',
      text: 'One of your 37 trillion cells, about 30 micrometers wide. Inside: mitochondria that make its energy, folded membranes that build its proteins, and a nucleus holding the instructions for all of you.',
    },
    {
      id: 'skin', z: -2.4, title: 'Fingertip', at: 'you',
      text: 'Ridges half a millimeter apart, dotted with sweat pores, trace a pattern no one else has ever had. Your skin sheds some 40,000 cells a minute.',
    },
    {
      id: 'you', z: 0.45, title: 'You', addr: 'You',
      text: 'About 1.7 meters of you: 37 trillion cells made of 7 octillion atoms, standing under the sky your part of Earth has right now.',
    },
    {
      id: 'edge', z: 5.55, title: 'Edge of Space', at: 'earth',
      text: 'The International Space Station flies about 400 km up. From here the air is a thin blue line: half of it lies within 5.5 km of the ground.',
    },
    {
      id: 'earth', z: 7.42, title: 'Earth', addr: 'Earth',
      text: 'Home to everyone you have ever met. 12,742 km across, lit exactly as the Sun lights it at this moment.',
    },
    {
      id: 'moon', z: 9.05, title: 'Earth and Moon',
      text: 'The Moon circles us 384,400 km away. Its light takes 1.3 seconds to reach your eyes.',
    },
    {
      id: 'inner', z: 11.55, title: 'Inner Solar System', addr: 'Solar System',
      text: 'Four rocky worlds huddle near the Sun. Sunlight takes 8 minutes and 20 seconds to reach Earth.',
    },
    {
      id: 'planets', z: 13.05, title: 'The Planets',
      text: 'Jupiter alone outweighs every other planet combined. Neptune circles 30 times farther from the Sun than we do.',
    },
    {
      id: 'helio', z: 14.05, title: 'Heliosphere',
      text: 'The solar wind blows a bubble whose edge lies about 120 AU out. Voyager 1 crossed it in 2012 and still calls home.',
    },
    {
      id: 'oort', z: 16.75, title: 'Oort Cloud',
      text: 'Perhaps a trillion icy bodies drift out here, loosely held by the Sun, reaching about a third of the way to the next star.',
    },
    {
      id: 'neighbors', z: 17.7, title: 'Stellar Neighborhood',
      text: 'Proxima Centauri is 4.2 light-years away. Most of our neighbors are red dwarfs too faint to see without a telescope.',
    },
    {
      id: 'orion', z: 19.55, title: 'Orion Arm', addr: 'Orion Arm',
      text: 'The Sun sits in a minor spiral arm, between the Sagittarius and Perseus arms, among nebulae where new stars are born.',
    },
    {
      id: 'milkyway', z: 21.15, title: 'Milky Way', addr: 'Milky Way',
      text: 'A few hundred billion stars in a disk 100,000 light-years wide. The Sun takes 230 million years to go around once.',
    },
    {
      id: 'localgroup', z: 22.6, title: 'Local Group', addr: 'Local Group',
      text: 'More than 80 galaxies bound by gravity. Andromeda is falling toward us at 110 km/s and may merge with the Milky Way in the next few billion years.',
    },
    {
      id: 'virgo', z: 23.95, title: 'Virgo Supercluster', addr: 'Virgo Supercluster',
      text: 'Thousands of galaxies gathered around the Virgo Cluster, 54 million light-years away.',
    },
    {
      id: 'laniakea', z: 24.8, title: 'Laniakea', addr: 'Laniakea Supercluster',
      text: 'About 100,000 galaxies whose motions all drain toward one region, the Great Attractor. Laniakea is Hawaiian for “immeasurable heaven.”',
    },
    {
      id: 'web', z: 25.95, title: 'Cosmic Web',
      text: 'At the largest scales, galaxies trace filaments and walls around voids hundreds of millions of light-years across.',
    },
    {
      id: 'observable', z: 27.3, title: 'Observable Universe', addr: 'Observable Universe', end: true,
      text: 'Everything whose light has had time to reach us: a sphere 93 billion light-years across, centered on you. Its edge is the oldest light there is.',
    },
    {
      id: 'beyond', z: 29.3, title: 'Beyond', addr: '…', end: true,
      text: 'No light from here has reached us, so no one knows. The universe may go on forever, or be one bubble among many. The map ends here.',
      speculative: true,
    },
  ];

  CA.Z_MIN = -34.8;
  CA.Z_MAX = 30.2;

  // ------------------------------------------------------------------ time zone → approximate location
  // Used only to place the "you are here" pin; never leaves the browser.
  CA.ZONES = {
    'Asia/Kolkata': [22.57, 88.36], 'Asia/Calcutta': [22.57, 88.36], 'Asia/Dubai': [25.2, 55.27],
    'Asia/Karachi': [24.86, 67.01], 'Asia/Dhaka': [23.81, 90.41], 'Asia/Kathmandu': [27.72, 85.32],
    'Asia/Colombo': [6.93, 79.86], 'Asia/Bangkok': [13.76, 100.5], 'Asia/Jakarta': [-6.21, 106.85],
    'Asia/Singapore': [1.35, 103.82], 'Asia/Kuala_Lumpur': [3.14, 101.69], 'Asia/Manila': [14.6, 120.98],
    'Asia/Shanghai': [31.23, 121.47], 'Asia/Hong_Kong': [22.32, 114.17], 'Asia/Taipei': [25.03, 121.57],
    'Asia/Seoul': [37.57, 126.98], 'Asia/Tokyo': [35.68, 139.69], 'Asia/Ho_Chi_Minh': [10.82, 106.63],
    'Asia/Riyadh': [24.71, 46.68], 'Asia/Tehran': [35.69, 51.39], 'Asia/Jerusalem': [31.77, 35.21],
    'Asia/Baghdad': [33.31, 44.37], 'Asia/Kabul': [34.56, 69.21], 'Asia/Tashkent': [41.3, 69.24],
    'Asia/Almaty': [43.24, 76.95], 'Asia/Yangon': [16.87, 96.2], 'Asia/Qatar': [25.29, 51.53],
    'Asia/Kuwait': [29.38, 47.99], 'Asia/Beirut': [33.89, 35.5], 'Asia/Amman': [31.95, 35.93],
    'Asia/Novosibirsk': [55.01, 82.93], 'Asia/Vladivostok': [43.12, 131.89], 'Asia/Ulaanbaatar': [47.89, 106.91],
    'Europe/London': [51.51, -0.13], 'Europe/Dublin': [53.35, -6.26], 'Europe/Lisbon': [38.72, -9.14],
    'Europe/Madrid': [40.42, -3.7], 'Europe/Paris': [48.86, 2.35], 'Europe/Berlin': [52.52, 13.4],
    'Europe/Rome': [41.9, 12.5], 'Europe/Amsterdam': [52.37, 4.9], 'Europe/Brussels': [50.85, 4.35],
    'Europe/Zurich': [47.38, 8.54], 'Europe/Vienna': [48.21, 16.37], 'Europe/Stockholm': [59.33, 18.07],
    'Europe/Oslo': [59.91, 10.75], 'Europe/Copenhagen': [55.68, 12.57], 'Europe/Helsinki': [60.17, 24.94],
    'Europe/Warsaw': [52.23, 21.01], 'Europe/Prague': [50.08, 14.44], 'Europe/Budapest': [47.5, 19.04],
    'Europe/Athens': [37.98, 23.73], 'Europe/Istanbul': [41.01, 28.98], 'Europe/Moscow': [55.76, 37.62],
    'Europe/Kyiv': [50.45, 30.52], 'Europe/Kiev': [50.45, 30.52], 'Europe/Bucharest': [44.43, 26.1],
    'Africa/Cairo': [30.04, 31.24], 'Africa/Lagos': [6.52, 3.38], 'Africa/Nairobi': [-1.29, 36.82],
    'Africa/Johannesburg': [-26.2, 28.05], 'Africa/Casablanca': [33.57, -7.59], 'Africa/Accra': [5.6, -0.19],
    'Africa/Addis_Ababa': [9.03, 38.74], 'Africa/Algiers': [36.75, 3.06], 'Africa/Tunis': [36.81, 10.18],
    'America/New_York': [40.71, -74.01], 'America/Chicago': [41.88, -87.63], 'America/Denver': [39.74, -104.99],
    'America/Los_Angeles': [34.05, -118.24], 'America/Phoenix': [33.45, -112.07], 'America/Anchorage': [61.22, -149.9],
    'America/Toronto': [43.65, -79.38], 'America/Vancouver': [49.28, -123.12], 'America/Mexico_City': [19.43, -99.13],
    'America/Bogota': [4.71, -74.07], 'America/Lima': [-12.05, -77.04], 'America/Santiago': [-33.45, -70.67],
    'America/Sao_Paulo': [-23.55, -46.63], 'America/Argentina/Buenos_Aires': [-34.6, -58.38],
    'America/Caracas': [10.48, -66.9], 'America/Halifax': [44.65, -63.57], 'America/Edmonton': [53.55, -113.49],
    'America/Winnipeg': [49.9, -97.14], 'America/Havana': [23.11, -82.37], 'America/Panama': [8.98, -79.52],
    'Pacific/Honolulu': [21.31, -157.86], 'Pacific/Auckland': [-36.85, 174.76], 'Australia/Sydney': [-33.87, 151.21],
    'Australia/Melbourne': [-37.81, 144.96], 'Australia/Brisbane': [-27.47, 153.03], 'Australia/Perth': [-31.95, 115.86],
    'Australia/Adelaide': [-34.93, 138.6], 'Atlantic/Reykjavik': [64.15, -21.94],
  };

  // Best guess at the viewer's location from the browser's time zone.
  CA.guessHome = function () {
    let zone = '';
    try { zone = Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch (e) { zone = ''; }
    const hit = CA.ZONES[zone];
    let place = zone.split('/').pop() || '';
    place = place.replace(/_/g, ' ');
    const alias = { Calcutta: 'Kolkata', Kiev: 'Kyiv', Saigon: 'Ho Chi Minh City', Rangoon: 'Yangon', Katmandu: 'Kathmandu', Bombay: 'Mumbai' };
    place = alias[place] || place;
    if (hit) return { lat: hit[0], lon: hit[1], place, zone, exact: true };
    const off = -new Date().getTimezoneOffset(); // minutes east of UTC
    return { lat: 25, lon: CA.clamp(off / 4, -180, 180), place: place || 'your time zone', zone, exact: false };
  };
})();
