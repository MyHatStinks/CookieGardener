let CookieGardener = {
	Settings: {
		Values: {
			ShowMutationTooltip: true,
			ShowSeedsTooltip: true,
			ShowNextTickPanel: true,
			ShowAvailablePanel: true,
			FixAging: true,
		},
		
		Get: function(name) {
			return Boolean(CookieGardener.Settings.Values[name]);
		},
		Set: function(name, on) {
			// if (on && CookieGardener.Cheats.includes(name)) {
				// Game.Win('Cheated cookies taste awful');
			// }
			
			if (CookieGardener.Settings.Values.hasOwnProperty(name)) {
				CookieGardener.Settings.Values[name] = Boolean(on);
			}
			
			let minigame = Game.Objects.Farm.minigame;
			switch (name) {
				case "FixAging":
					// With this setting disabled plan age always rounds
					// We floor it here to prevent rapid aging by toggling
					for (let y=0; y<6; y++)
					{
						for (let x=0; x<6; x++)
						{
							if (!minigame.isTileUnlocked(x,y))
							{
								continue;
							}
							
							let tile = minigame.plot[y][x];
							tile[0] = Math.floor(tile[0]);
						}
					}
					break;
				case "ShowNextTickPanel":
					CookieGardener.Menu.BuildNextTickList();
					break;
				case "ShowAvailablePanel":
					CookieGardener.Menu.BuildAvailabilityList();
					break;
				default:
					break;
			}
		},
	},
	// Cheats: ['PreventDecay'],
	
	Css: `
		.GardenSeedSource {
			display: inline-block;
			border: 1px solid;
			text-align: center;
			width: 144px;
			margin: 3px;
		}
		
		.GardenSeedSource > .icon {
			width: 48px;
			height: 48px;
			margin: 0px;
			padding: 0px;
			background: none;
		}
		
		.GardenSeedSource .TargetPlot {
			border: 3px dashed;
			border-radius: 50%;
			border-color: #33ff3344;
			position: absolute;
			left: 5%;
			right: 5%;
			top: 5%;
			bottom: 5%;
		}
		
		.GardenSeedSource .SourcePlant {
			background:url(img/gardenPlants.png?v=${Game.version});
			width: 48px;
			height: 48px;
			z-index: 1000;
		}
		
		.GardenSeedSource .SourcePlant span {
			position: absolute;
			bottom: 0;
			left: 0;
			right: 0;
			text-shadow: 1px 1px 2px #000000 !important;
		}
		
		.GardenSeedSource .icon:before {
			transform: translate(0,0);
			opacity: 0.65;
			transition: opacity 0.2s;
			pointer-events: none;
			content: '';
			display: block;
			position: absolute;
			left: 0px;
			top: 0px;
			right: 0px;
			bottom: 0px;
			margin: 0px;
			background: url(img/gardenPlots.png);
		}
		
		.GardenSeedSource .icon:nth-child(4n):before{
			background-position:4px 4px;
		}
		.GardenSeedSource .icon:nth-child(4n+1):before{
			background-position:44px 4px;
		}
		.GardenSeedSource .icon:nth-child(4n+2):before{
			background-position:84px 4px;
		}
		.GardenSeedSource .icon:nth-child(4n+3):before{
			background-position:124px 4px;
		}
	`,
	
	Init: function() {
		// Add cheats to settings dict
		// for (let cheat of CookieGardener.Cheats) {
			// CookieGardener.Settings[cheat] = false;
		// }
		
		let farm = Game.Objects.Farm;
		// Override tooltip generation
		let oldLoadMinigames = Game.LoadMinigames;
		Game.LoadMinigames = function() {
			oldLoadMinigames();
			
			setTimeout(function() {
				let scriptElement = l('minigameScript-'+farm.id);
				if (!scriptElement)
				{
					// Probably too early, should get another shot later
					return;
				}
				
				let oldOnLoad = scriptElement.onload;
				scriptElement.onload = function() {
					farm.minigame.save = CookieGardener.Logic.Save;
					farm.minigame.load = CookieGardener.Logic.Load;
					oldOnLoad();
					CookieGardener.Logic.Replace();
					CookieGardener.Seeds.Replace();
					CookieGardener.Tooltips.Replace();
					CookieGardener.Menu.Replace();
				}
			}, 11);
			
			// Cookie Monster overrides our overrides here, but helpfully does also call this function;
			// if we delay by a tick we should always load after them
			setTimeout(function() {
				CookieGardener.Tooltips.Replace();
			}, 1);
		}
		Game.LoadMinigames();
		
		// Add our CSS stuff
		CookieGardener.CssElement = document.createElement('style');
		CookieGardener.CssElement.type = 'text/css';
		CookieGardener.CssElement.id = 'CookieGardenerCSS';
		
		document.head.appendChild(CookieGardener.CssElement);
		
		CookieGardener.CssElement.textContent = CookieGardener.Css;
	},
	
	Mutation: {
		GetOdds: function(x,y, whenMature) {
			let minigame = Game.Objects.Farm.minigame;
			
			// Init
			minigame.computeBoostPlot();
			let weedMult = minigame.soilsById[minigame.soil].weedMult;
			
			let hasNeighbours = false;
			let neighbours = [];
			let neighboursMature = [];
			
			for (let i in minigame.plants)
			{
				neighbours[i] = 0;
				neighboursMature[i] = 0;
			}
			
			// Calculating number of loops
			let loops=1;
			if (minigame.soilsById[minigame.soil].key == 'woodchips') {
				loops=3;
			}
			loops *= minigame.loopsMult;
			
			// Find adjacent plants
			for (let checkX = -1; checkX <= 1; checkX++)
			{
				for (let checkY = -1; checkY <= 1; checkY++)
				{
					if (checkX === 0 && checkY === 0)
					{
						continue;
					}
					
					let adjacentPlant = minigame.getTile(Number(x) + checkX, Number(y) + checkY);
					if (adjacentPlant[0] <= 0)
					{
						continue;
					}
					
					hasNeighbours = true;
					
					let age = adjacentPlant[1];
					let plantType = minigame.plantsById[adjacentPlant[0]-1];
					
					neighbours[plantType.key]++;
					if (age >= plantType.mature)
					{
						neighboursMature[plantType.key]++;
					}
				}
			}
			
			// No neighbours, calculate weeds
			if (!hasNeighbours) {
				let weedsChance = 0.002 * weedMult * minigame.plotBoost[y][x][2];
				if (weedsChance > 0)
				{
					return [["meddleweed",weedsChance], ["Nothing!", 1 - weedsChance]];
				}
				
				return [["Nothing!", 1]];
			}
			
			// Get weighted odds
			let weedsChance = weedMult * minigame.plotBoost[y][x][2];
			let fungusChance = minigame.plotBoost[y][x][2];
			let weightedMutations = CookieGardener.Mutation.GetOddsFromNeighbours(
				neighbours,
				whenMature ? neighbours : neighboursMature,
				weedsChance,
				fungusChance);
			
			// Transform into expected array
			let sum = 0;
			let results = [];
			for (let [k, v] of Object.entries(weightedMutations)) {
				let odds = 1-Math.pow(1-v, loops)
				sum += odds;
				results.push([k, odds]);
			}
			
			results.push(["Nothing!", 1 - sum]);
			
			return results;
		},
		GetOddsWhenMature: function(x,y) {
			return CookieGardener.Mutation.GetOdds(x,y,true);
		},
		
		GetOddsFromNeighbours: function(neighbours, neighboursMature, weedsChance, fungusChance) {
			let minigame = Game.Objects.Farm.minigame;
			
			var count = 0;
			for (let [k,v] of Object.entries(neighbours)) { count += v; }
			if (count <= 0) {
				weedsChance  = 0.002 * (weedsChance ?? 1);
				if (weedsChance > 0)
				{
					return {"meddleweed": weedsChance};
				}
				
				return {};
			}
			
			// Has neighbours, get spread chances
			let possibleMutations = minigame.getMuts(neighbours, neighboursMature);
			
			// Correcting weeds/fungus odds
			for (let i = 0; i < possibleMutations.length; i++) {
				let plantType = minigame.plants[possibleMutations[i][0]];
				if (plantType.weed) {
					possibleMutations[i][1] *= weedsChance ?? 1;
				} else if (plantType.fungus) {
					possibleMutations[i][1] *= fungusChance ?? 1;
				}
			}
			
			if (possibleMutations.length <=1) {
				if (possibleMutations.length === 1) {
					return {
						[possibleMutations[0][0]]: possibleMutations[0][1],
					};
				}
				
				return {};
			}
			
			// Calculate random pools
			// There's probably a better way to do this?
			let pools = [];
			
			let firstPlant = possibleMutations[0];
			pools.push({
				plants: [firstPlant[0]],
				odds: 1 * firstPlant[1],
			})
			pools.push({
				plants: [],
				odds: 1 * (1 - firstPlant[1]),
			})
			
			for (let i = 1; i < possibleMutations.length; i++) {
				let thisPlant = possibleMutations[i];
				let poolLength = pools.length;
				for (let n = 0; n < poolLength; n++) {
					let pool = pools[n];
					let newPool = {
						plants: pool.plants.slice(),
						odds: pool.odds * (1 - thisPlant[1]),
					}
					pools.push(newPool);
					
					pool.plants.push(thisPlant[0]);
					pool.odds *= thisPlant[1];
				}
			}
			
			// Convert pools back into raw numbers
			let mutationToWeight = {};
			for (let i = 0; i < pools.length; i++) {
				let pool = pools[i];
				pool.plants.forEach(plantName => {
					mutationToWeight[plantName] = (mutationToWeight[plantName] ?? 0) + (pool.odds / pool.plants.length);
				})
			}
			
			return mutationToWeight;
		}
	},
	
	Tooltips: {
		GrowthState: 0,
		GrowingStateUpdated: 0,
		GetGrowingState: function() {
			// Panel is refreshed constantly, need this function so growth animation is consistent
			if (Date.now() > (CookieGardener.Tooltips.GrowingStateUpdated + 250)) {
				CookieGardener.Tooltips.GrowthState = (CookieGardener.Tooltips.GrowthState + 1) % 4;
				CookieGardener.Tooltips.GrowingStateUpdated = Date.now();
			}
			
			return CookieGardener.Tooltips.GrowthState;
		},
		
		Replace: function() {
			if (!Game.Objects.Farm.minigameLoaded) {
				return;
			}
			
			Array.from(l('gardenPlot').children).forEach((child) => {
				const coords = child.id.slice(-3);
				child.onmouseover = function () {
					Game.tooltip.dynamic = 1;
					Game.tooltip.draw(this, () => CookieGardener.Tooltips.CreatePlot([`${coords[0]}`, `${coords[2]}`]), 'this');
					Game.tooltip.wobble();
				};
			});
			
			Array.from(l('gardenSeeds').children).forEach((child) => {
				const name = child.id.slice(11);
				child.onmouseover = function () {
					Game.tooltip.dynamic = 1;
					Game.tooltip.draw(this, () => CookieGardener.Tooltips.CreateSeed(name), 'this');
					Game.tooltip.wobble();
				};
			});
		},
		
		Setup: function() {
			let area = document.createElement('div');
			area.id = 'GardenerTooltipArea';
			l('tooltip').appendChild(area);
			
			if (l('tooltipAnchor').style.display === 'none' || !l('GardenerTooltipArea')) {
				return;
			}
			
			l('GardenerTooltipArea').innerHTML = '';
			
			l('tooltip').firstChild.style.paddingBottom = '4px';
			const tooltipBox = document.createElement('div');
			tooltipBox.style.border = '1px solid';
			tooltipBox.style.padding = '4px';
			tooltipBox.style.margin = '0px -4px';
			tooltipBox.id = 'GardenerTooltipBorder';
			l('GardenerTooltipArea').appendChild(tooltipBox);
			
			return tooltipBox;
		},
		
		CreatePlot: function(name) {
			l('tooltip').innerHTML = Game.ObjectsById[2].minigame.tileTooltip(name[0], name[1])();
			
			if (Game.keys[16]) {
				return l('tooltip').innerHTML;
			}
			
			if (CookieGardener.Settings.Get("ShowMutationTooltip")) {
				if (CookieGardener.Tooltips.Setup(name)) {
					CookieGardener.Tooltips.UpdatePlot(name);
				}
			}
			
			// Cookie Monster compatibility //
			// Cookie Monster has tooltips on plants that we had to overwrite, re-add them if Cookie Monster is installed
			if (typeof CookieMonsterData != "undefined") {
				const tooltipBox = document.createElement('div');
				tooltipBox.style.border = '1px solid';
				tooltipBox.style.padding = '4px';
				tooltipBox.style.margin = '0px -4px';
				tooltipBox.id = 'CMTooltipBorder';
				tooltipBox.className = 'CMBorderGray';
				
				l('tooltip').appendChild(tooltipBox);
				
				let minigame = Game.Objects.Farm.minigame;
				let tooltipSetting = Game.mods.cookieMonsterFramework.saveData.cookieMonsterMod.settings.TooltipPlots;
				let plotData = minigame.plot[name[1]][name[0]];
				if (tooltipSetting && plotData[0] !== 0) {
					const mature = plotData[1] > minigame.plantsById[plotData[0] - 1].mature;
					const plantName = minigame.plantsById[plotData[0] - 1].name;
					
					let header = document.createElement('div');
					header.style.fontWeight = 'bold';
					header.textContent = 'Reward (Current / Maximum)';
					header.id = `${header.textContent}Title`;
					header.className = "CMTextBlue";
					
					tooltipBox.appendChild(header);
					const reward = document.createElement('div');
					reward.id = 'CMTooltipPlantReward';
					tooltipBox.appendChild(reward);
					
					if (plantName === 'Bakeberry') {
						reward.textContent = `${
						mature ? Beautify(Math.min(Game.cookies * 0.03, Game.cookiesPs * 60 * 30)) : '0'
						} / ${Beautify(Game.cookiesPs * 60 * 30)}`;
					} else if (plantName === 'Chocoroot' || plantName === 'White chocoroot') {
						reward.textContent = `${
						mature ? Beautify(Math.min(Game.cookies * 0.03, Game.cookiesPs * 60 * 3)) : '0'
						} / ${Beautify(Game.cookiesPs * 60 * 3)}`;
					} else if (plantName === 'Queenbeet') {
						reward.textContent = `${
						mature ? Beautify(Math.min(Game.cookies * 0.04, Game.cookiesPs * 60 * 60)) : '0'
						} / ${Beautify(Game.cookiesPs * 60 * 60)}`;
					} else if (plantName === 'Duketater') {
						reward.textContent = `${
						mature ? Beautify(Math.min(Game.cookies * 0.08, Game.cookiesPs * 60 * 120)) : '0'
						} / ${Beautify(Game.cookiesPs * 60 * 120)}`;
					} else tooltipBox.style.display = 'none';
				} else tooltipBox.style.display = 'none';
			}
			// End of Cookie Monster stuff //
			
			return l('tooltip').innerHTML;
		},
		
		UpdatePlot: function(name) {
			let minigame = Game.Objects.Farm.minigame;
			
			if (minigame.plot[name[1]][name[0]][0] !== 0) {
				l('GardenerTooltipArea').style.display = 'none';
				return;
			}
			
			const reward = document.createElement('div');
			reward.id = 'GardenerTooltipPlotMutation';
			
			l('GardenerTooltipBorder').appendChild(reward);
			
			let str = `Next tick:`;
			let odds = CookieGardener.Mutation.GetOdds(name[0], name[1]);
			if (odds.length <= 0) {
				str += `<p>Nothing!</p>`;
			} else {
				for (let i = 0; i < odds.length; i++) {
					let plantType = minigame.plants[odds[i][0]];
					if (plantType) {
						str += `<p>
							<div class="gardenSeedTiny" style="background-position:${-0*48}px ${-plantType.icon*48}px;"></div>
							${(plantType?.name ?? odds[i][0])} - ${(odds[i][1] * 100).toFixed(2)}%
						</p>`;
					} else {
						str += `<p>${odds[i][0]} - ${(odds[i][1] * 100).toFixed(2)}%</p>`;
					}
				}
			}
			
			let matureOdds = CookieGardener.Mutation.GetOddsWhenMature(name[0], name[1]);
			if (matureOdds.length > 0 && matureOdds.length != odds.length) {
				str += `<hr /> When mature:`;
				for (let i = 0; i < matureOdds.length; i++) {
					let plantType = minigame.plants[matureOdds[i][0]];
					if (plantType) {
						str += `<p>
							<div class="gardenSeedTiny" style="background-position:${-0*48}px ${-plantType.icon*48}px;"></div>
							${(plantType?.name ?? matureOdds[i][0])} - ${(matureOdds[i][1] * 100).toFixed(2)}%
						</p>`;
					} else {
						str += `<p>${matureOdds[i][0]} - ${(matureOdds[i][1] * 100).toFixed(2)}%</p>`;
					}
				}
			}
			
			l('GardenerTooltipPlotMutation').innerHTML = str;
		},
		
		CreateSeed: function(name, simplified) {
			if (simplified) {
				let plant = Game.Objects.Farm.minigame.plantsById[name];
				l('tooltip').innerHTML = `<div style="padding:8px 4px;min-width:250px;">
					<div class="icon" style="
						background:url(img/gardenPlants.png?v=${Game.Version});
						float:left;
						margin-left:-24px;
						margin-top:-4px;
						background-position:${(-0*48)}px ${(-plant.icon*48)}px;"></div>
					<div class="icon" style="
						background:url(img/gardenPlants.png?v=${Game.Version});
						float:left;
						margin-left:-24px;
						margin-top:-28px;
						background-position:${(-4*48)}px ${(-plant.icon*48)}px;"></div>
					<div style="
						background:url(img/turnInto.png);
						width:20px;
						height:22px;
						position:absolute;
						left:28px;
						top:24px;
						z-index:1000;"></div>
						<div style="width:300px;">
							<div class="name">${plant.name} seed</div>
						</div>
					<div class="line"></div>
				</div>`;
			} else {
				l('tooltip').innerHTML = Game.ObjectsById[2].minigame.seedTooltip(name)();
			}
			
			if (simplified || CookieGardener.Settings.Get("ShowSeedsTooltip")) {
				if (CookieGardener.Tooltips.Setup(name)) {
					if (simplified) {
						l('GardenerTooltipBorder').style.border = '';
					}
					
					CookieGardener.Tooltips.UpdateSeed(name, simplified);
				}
			}
			
			return l('tooltip').innerHTML;
		},
		
		UpdateSeed: function(id, simplified) {
			let minigame = Game.Objects.Farm.minigame;
			
			let plants = minigame.plantsById[id];
			let name = plants?.key;
			let recipes = CookieGardener.Seeds.Recipes[name ?? ''];
			if (!plants || !name || !recipes || recipes.length == 0) {
				l('GardenerTooltipArea').style.display = 'none';
				return;
			}
			
			let targetPlantData = minigame.plants[name];
			
			let sources = document.createElement('div');
			sources.id = 'GardenerTooltipSeedSources';
			l('GardenerTooltipBorder').appendChild(sources);
			
			let blankPlantList = {}
			for (let i in minigame.plants)
			{
				blankPlantList[i] = 0;
			}
			
			let str = simplified ? '<div style="padding-bottom: 10px"></div>' : `Sources: <div><div>`;
			for (let i = 0; i < recipes.length; i++) {
				let requiredPlants = {...blankPlantList};
				let recipe = recipes[i]
				str += `<div class="GardenSeedSource">`
				for (let col = 0; col < (recipe.plants.length / 3); col++) {
					for (let row = 0; row < 3 && ((col * 3) + row) < recipe.plants.length; row++) {
						let item = recipe.plants[(col * 3) + row];
						if (typeof item == "string") {
							item = {
								name: item,
								type: "spread",
							}
						}
						
						let plantName = item.name;
						let minigameData = plantName && minigame.plants[plantName];
						if (!minigameData) {
							switch (item.type ?? "spread") {
								case "target":
									str += `<div class="icon">
										<div class="TargetPlot"></div>
										<div class="SourcePlant" style="
											background-position:${-1*48}px ${-targetPlantData.icon*48}px;
											opacity: 0.75;">
										</div>
									</div>`;
									break;
								default:
									str += `<div class="icon"></div>`;
									break;
							}
							continue;
						}
						
						requiredPlants[plantName] += 1;
						
						switch (item.type ?? "spread") {
							case "harvest":
								str += `<div class="icon">
									<div class="SourcePlant" style="background-position:${-4*48}px ${-minigameData.icon*48}px;">
										<span>Harvest</span>
									</div>
								</div>`;
								break;
							case "growing":
								let mod = (CookieGardener.Tooltips.GetGrowingState() + col + row*3) % 4 + 1;
								str += `<div class="icon">
									<div class="SourcePlant GrowingPlant" style="background-position:${-mod*48}px ${-minigameData.icon*48}px;">
										<span>Any</span>
									</div>
								</div>`;
								break;
							default:
								str += `<div class="icon">
									<div class="SourcePlant" style="background-position:${-4*48}px ${-minigameData.icon*48}px;">
									</div>
								</div>`;
								break;
						}
					}
				}
				
				let odds = recipe.odds ?? CookieGardener.Mutation.GetOddsFromNeighbours(requiredPlants, requiredPlants)[name];
				str += `<p>${((odds ?? 0) * 100).toFixed(2)}%</p>`;
				str += `</div>`;
			}
			
			l('GardenerTooltipSeedSources').innerHTML = str;
		},
	},
	
	Menu: {
		Replace: function() {
			if (!Game.Objects.Farm.minigameLoaded) {
				return;
			}
			
			let minigame = Game.Objects.Farm.minigame;
			
			let parent = l('gardenPanel');
			let div = document.createElement('div');
			parent.appendChild(div);
			
			let str = `<div id="gardenNextOddsTitle" class="title gardenPanelLabel">Next Tick</div>
				<div id="gardenNextOddsLine" class="line"></div>
				<div id="gardenNextOdds">[Odds Here]</div>
				
				<div id="gardenNextSeedsTitle" class="title gardenPanelLabel">Next Available Seeds</div>
				<div id="gardenNextSeedsLine" class="line"></div>
				<div id="gardenNextSeeds">[Next Seeds Here]</div>`;
			
			div.innerHTML = str;
			
			CookieGardener.Menu.BuildNextTickList();
			CookieGardener.Menu.BuildAvailabilityList();
			
			// Planting or harvesting
			let oldUseTool = minigame.useTool;
			minigame.useTool = function(what, x, y) {
				let success = oldUseTool(what, x, y);
				CookieGardener.Menu.BuildNextTickList();
				
				return success;
			}
			
			// Updating Soil
			let oldComputeStepT = minigame.computeStepT
			minigame.computeStepT = function() {
				oldComputeStepT();
				CookieGardener.Menu.BuildNextTickList();
			}
		},
		
		BuildAvailabilityList: function() {
			if (!l('gardenNextSeeds')) {
				return;
			}
			
			if (!CookieGardener.Settings.Get('ShowAvailablePanel')) {
				l('gardenNextSeedsTitle').style.display = "none";
				l('gardenNextSeedsLine').style.display = "none";
				l('gardenNextSeeds').style.display = "none";
				
				return;
			}
			
			l('gardenNextSeedsTitle').style.display = "block";
			l('gardenNextSeedsLine').style.display = "block";
			l('gardenNextSeeds').style.display = "block";
			
			let list = l('gardenNextSeeds');
			
			let minigame = Game.Objects.Farm.minigame;
			let availableMutations = [];
			
			// This is a bit of a mess, needs reworked
			// Checks our recipes for any locked plants to see if we can make it
			// using only plants we have unlocked
			thisPlant: for (let i = 0; i < minigame.plantsById.length; i++) {
				let plant = minigame.plantsById[i];
				if (plant.unlocked) {
					continue;
				}
				
				let recipes = CookieGardener.Seeds.Recipes[plant.key];
				if (!recipes) {
					continue;
				}
				
				for (let recipeId = 0; recipeId < recipes.length; recipeId++) {
					let canMake = true;
					
					thisRecipe: for (let plantIndex = 0; plantIndex < recipes[recipeId].plants.length; plantIndex++) {
						let item = recipes[recipeId].plants[plantIndex];
						let name = (typeof item === "string") ? item : item?.name;
						
						if (name && !(minigame.plants[name] && minigame.plants[name].unlocked)) {
							canMake = false;
							break thisRecipe;
						}
					}
					
					if (canMake) {
						availableMutations.push(plant.key);
						continue thisPlant;
					}
				}
			}
			
			if (availableMutations.length === 0) {
				list.innerHTML = `<div>None!</div>`;
			} else {
				list.innerHTML = '';
				for (let i = 0; i < availableMutations.length; i++) {
					let plant = minigame.plants[availableMutations[i]];
					
					let newDiv = document.createElement('div');
					newDiv.id = "gardenSeedAvailable";
					newDiv.className = "gardenSeed";
					newDiv.style.opacity = 0.2;
					newDiv.onmouseover = function () {
						Game.tooltip.dynamic = 1;
						Game.tooltip.draw(this, () => CookieGardener.Tooltips.CreateSeed(plant.id, true), 'this');
						Game.tooltip.wobble();
					};
					newDiv.onmouseout = function() {
						Game.tooltip.shouldHide = 1;
					}
					
					newDiv.innerHTML = `<div
						id="gardenSeedIcon-${plant.id}"
						class="gardenSeedIcon shadowFilter"
						style="background-position:${-0*48}px ${-plant.icon*48}px;">
					</div>`;
					
					list.appendChild(newDiv);
				}
			}
		},
		
		BuildNextTickList: function() {
			if (!CookieGardener.Settings.Get('ShowNextTickPanel')) {
				l('gardenNextOddsTitle').style.display = "none";
				l('gardenNextOddsLine').style.display = "none";
				l('gardenNextOdds').style.display = "none";
				
				return;
			}
			
			l('gardenNextOddsTitle').style.display = "block";
			l('gardenNextOddsLine').style.display = "block";
			l('gardenNextOdds').style.display = "block";
			
			let minigame = Game.Objects.Farm.minigame;
			let list = l('gardenNextOdds');
			
			let totalOdds = {};
			let emptyOdds = 1;
			for (let y = 0; y < 6; y++) {
				for (let x = 0; x < 6; x++) {
					if (minigame.plot[y][x][0] !== 0) {
						continue;
					}
					
					let odds = CookieGardener.Mutation.GetOdds(x, y);
					let sum = 0;
					for (let i = 0; i < odds.length; i++) {
						let plantName = odds[i][0];
						let plantOdds = odds[i][1];
						let plantType = minigame.plants[plantName];
						if (!plantType) {
							continue;
						}
						
						totalOdds[plantName] = 1 - ((1 - (totalOdds[plantName] ?? 0)) * (1 - plantOdds));
						sum += plantOdds;
					}
					
					emptyOdds *= (1 - sum);
				}
			}
			
			let str = ``;
			for (let [plantName, chance] of Object.entries(totalOdds)) {
				let plantType = minigame.plants[plantName];
				if (!plantType) {
					continue;
				}
				
				str += `<p>
					<div class="gardenSeedTiny" style="background-position:${-0*48}px ${-plantType.icon*48}px;"></div>
					${plantType.name} - ${(chance * 100).toFixed(2)}%
				</p>`;
			}
			
			str += `<p>
				Nothing! - ${(emptyOdds * 100).toFixed(2)}%
			</p>`;
			
			list.innerHTML = str;
		}
	},
	
	Seeds: {
		Recipes: {
			'bakerWheat': [
				{
					plants: ['bakerWheat', {type:'target'}, 'bakerWheat'],
				},
				{
					plants: ['thumbcorn', {type:'target'}, 'thumbcorn'],
				},
			],
			'thumbcorn': [
				{
					plants: ['bakerWheat', {type:'target'}, 'bakerWheat'],
				},
				{
					plants: ['thumbcorn', {type:'target'}, 'thumbcorn'],
				},
				{
					plants: ['cronerice', {type:'target'}, 'cronerice'],
				},
			],
			'cronerice': [
				{
					plants: ['bakerWheat', {type:'target'}, 'thumbcorn'],
				},
			],
			'gildmillet': [
				{
					plants: ['thumbcorn', {type:'target'}, 'cronerice'],
				},
			],
			'clover': [
				{
					plants: ['bakerWheat', {type:'target'}, 'gildmillet'],
				},
				{
					plants: ['clover', {type:'target'}, 'clover'],
				},
			],
			'goldenClover': [
				{
					plants: ['bakerWheat', {type:'target'}, 'gildmillet'],
				},
				{
					plants: ['clover', {type:'target'}, 'clover'],
				},
				{
					plants: [
						'clover', {type:'target'}, 'clover',
						'clover', '', 'clover',
					],
				},
			],
			'shimmerlily': [
				{
					plants: ['clover', {type:'target'}, 'gildmillet'],
				},
			],
			'elderwort': [
				{
					plants: ['shimmerlily', {type:'target'}, 'cronerice'],
				},
			],
			'bakeberry': [
				{
					plants: ['bakerWheat', {type:'target'}, 'bakerWheat'],
				},
			],
			'chocoroot': [
				{
					plants: ['bakerWheat', {type:'target'}, {name: 'brownMold', type:'growing'}],
				},
			],
			'whiteChocoroot': [
				{
					plants: ['chocoroot', {type:'target'}, {name: 'whiteMildew', type:'growing'}],
				},
			],
			
			'whiteMildew': [
				{
					plants: ['brownMold', {type:'target'}],
				},
			],
			'brownMold': [
				{
					plants: [ {name: 'meddleweed', type:'harvest'} ],
					odds: 0.2 / 2,
				},
				{
					plants: ['whiteMildew', {type:'target'}],
				},
			],
			'meddleweed': [
				{
					plants: ['meddleweed', {type:'target'}],
				},
				{
					plants: [
						'', '', '',
						'', {type:'target'}, '',
						'', '', '',
					],
				},
			],
			
			'whiskerbloom': [
				{
					plants: ['shimmerlily', {type:'target'}, 'whiteChocoroot'],
				},
			],
			'chimerose': [
				{
					plants: ['shimmerlily', {type:'target'}, 'whiskerbloom'],
				},
				{
					plants: ['chimerose', {type:'target'}, 'chimerose'],
				},
			],
			'nursetulip': [
				{
					plants: ['whiskerbloom', {type:'target'}, 'whiskerbloom'],
				},
			],
			'drowsyfern': [
				{
					plants: ['chocoroot', {type:'target'}, 'keenmoss'],
				},
			],
			'wardlichen': [
				{
					plants: ['cronerice', {type:'target'}, 'keenmoss'],
				},
				{
					plants: ['cronerice', {type:'target'}, 'whiteMildew'],
				},
				{
					plants: ['wardlichen', {type:'target'}],
				},
			],
			'keenmoss': [
				{
					plants: ['greenRot', {type:'target'}, 'brownMold'],
				},
				{
					plants: ['keenmoss', {type:'target'}],
				},
			],
			'queenbeet': [
				{
					plants: ['chocoroot', {type:'target'}, 'bakeberry'],
				},
			],
			'queenbeetLump': [
				{
					plants: [
						'queenbeet', 'queenbeet', 'queenbeet',
						'queenbeet', {type:'target'}, 'queenbeet',
						'queenbeet', 'queenbeet', 'queenbeet',
					],
				},
			],
			'duketater': [
				{
					plants: ['queenbeet', {type:'target'}, 'queenbeet'],
				},
			],
			
			'crumbspore': [
				{
					plants: [ {name: 'meddleweed', type:'harvest'} ],
					odds: 0.2 / 2,
				},
				{
					plants: ['crumbspore', {type:'target'}],
				},
				{
					plants: ['doughshroom', {type:'target'}, 'doughshroom'],
				},
			],
			'doughshroom': [
				{
					plants: ['doughshroom', {type:'target'}],
				},
				{
					plants: ['crumbspore', {type:'target'}, 'crumbspore'],
				},
			],
			'glovemorel': [
				{
					plants: ['crumbspore', {type:'target'}, 'thumbcorn'],
				},
			],
			'cheapcap': [
				{
					plants: ['crumbspore', {type:'target'}, 'shimmerlily'],
				},
			],
			'foolBolete': [
				{
					plants: ['doughshroom', {type:'target'}, 'greenRot'],
				},
			],
			'wrinklegill': [
				{
					plants: ['crumbspore', {type:'target'}, 'brownMold'],
				},
			],
			'greenRot': [
				{
					plants: ['whiteMildew', {type:'target'}, 'clover'],
				},
			],
			'shriekbulb': [
				{
					plants: [{name: 'shriekbulb', type:'growing'}, {type:'target'}],
				},
				{
					plants: ['wrinklegill', {type:'target'}, 'elderwort'],
				},
				{
					plants: [
						'elderwort', {type:'target'}, 'elderwort',
						'elderwort', 'elderwort', 'elderwort',
					],
				},
				{
					plants: [
						{name: 'duketater', type:'growing'}, {type:'target'}, {name: 'duketater', type:'growing'},
						'', {name: 'duketater', type:'growing'}, '',
					],
				},
				{
					plants: [
						{name: 'doughshroom', type:'growing'}, {type:'target'}, {name: 'doughshroom', type:'growing'},
						{name: 'doughshroom', type:'growing'}, '', {name: 'doughshroom', type:'growing'},
					],
				},
				{
					plants: [
						'queenbeet', {type:'target'}, 'queenbeet',
						'queenbeet', 'queenbeet', 'queenbeet',
					],
				},
			],
			
			'tidygrass': [
				{
					plants: ['bakerWheat', {type:'target'}, 'whiteChocoroot'],
				},
			],
			'everdaisy': [
				{
					plants: [
						'tidygrass', '', 'elderwort',
						'tidygrass', {type:'target'}, 'elderwort',
						'tidygrass', '', 'elderwort',
					],
				},
			],
			'ichorpuff': [
				{
					plants: ['elderwort', {type:'target'}, 'crumbspore'],
				},
			],
		},
		
		Replace: function() {
			if (!Game.Objects.Farm.minigameLoaded) {
				return;
			}
			
			let minigame = Game.Objects.Farm.minigame;
			
			// Unlocking Seeds
			let oldUnlock = minigame.unlockSeed;
			minigame.unlockSeed = function(seed) {
				let success = oldUnlock(seed);
				if (success) {
					CookieGardener.Seeds.Unlock(seed);
				}
				
				return success;
			}
			
			let oldLock = minigame.lockSeed;
			minigame.lockSeed = function(seed) {
				let success = oldLock(seed);
				if (success) {
					CookieGardener.Seeds.Lock(seed);
				}
				
				return success;
			}
			
			for (var i in minigame.plants)
			{
				var seed = minigame.plants[i];
				if (seed.unlocked) {
					continue;
				}
				
				CookieGardener.Seeds.Lock(seed);
			}
		},
		
		Lock: function(seed) {
			if (!seed.l) {
				return;
			}
			
			seed.l.classList.remove('locked');
			seed.l.style.opacity = 0.2;
			
			// Replace element to clear click events; Cookie Clicker has no additional
			// checks and just lets you plants anything
			let clone = seed.l.cloneNode(true)
			seed.l.replaceWith(clone);
			seed.l = clone;
			
			AddEvent(seed.l,'click', CookieGardener.Seeds.OnClick(seed));
			
			const name = seed.l.id.slice(11);
			seed.l.onmouseover = function () {
				Game.tooltip.dynamic = 1;
				Game.tooltip.draw(this, () => CookieGardener.Tooltips.CreateSeed(name), 'this');
				Game.tooltip.wobble();
			};
			
			CookieGardener.Menu.BuildAvailabilityList();
		},
		
		Unlock: function(seed) {
			let minigame = Game.Objects.Farm.minigame;
			
			if (!seed.l) {
				return;
			}
			
			seed.l.classList.remove('locked');
			seed.l.style.opacity = '';
			
			// Replace element just to refresh events; it should work without this, but doesn't
			let clone = seed.l.cloneNode(true)
			seed.l.replaceWith(clone);
			seed.l = clone;
			
			// Re-add events (copied from base minigame)
			AddEvent(seed.l,'click', CookieGardener.Seeds.OnClick(seed));
			AddEvent(seed.l,'mouseover',minigame.hideCursor);
			AddEvent(seed.l,'mouseout',minigame.showCursor);
			
			const name = seed.l.id.slice(11);
			seed.l.onmouseover = function () {
				Game.tooltip.dynamic = 1;
				Game.tooltip.draw(this, () => CookieGardener.Tooltips.CreateSeed(name), 'this');
				Game.tooltip.wobble();
			};
			
			CookieGardener.Menu.BuildAvailabilityList();
		},
		
		OnClick: function(seed){
			let minigame = Game.Objects.Farm.minigame;
			
			return function() {
				if (Game.keys[16] && Game.keys[17]) // Shift & ctrl
				{
					// Harvest all mature of type
					minigame.harvestAll(seed, 1);
					return false;
				}
				
				if (!(seed.plantable && seed.unlocked) && !Game.sesame) {
					return false;
				}
				
				if (minigame.seedSelected==seed.id) {
					minigame.seedSelected=-1;
				}
				else {
					minigame.seedSelected=seed.id;PlaySound('snd/toneTick.mp3');
				}
				
				for (var i in minigame.plants)
				{
					var it=minigame.plants[i];
					if (it.id==minigame.seedSelected) {
						it.l.classList.add('on');
					} else {
						it.l.classList.remove('on');
					}
				}
			}
		},
	},
	
	Logic: {
		Replace: function() {
			if (!Game.Objects.Farm.minigameLoaded) {
				return;
			}
			
			let minigame = Game.Objects.Farm.minigame;
			
			let oldLogic = minigame.logic
			minigame.logic = function() {
				CookieGardener.Logic.Run(oldLogic);
			}
		},
		
		Run: function(oldLogic) {
			if (!CookieGardener.Settings.Get("FixAging")) {
				oldLogic();
				return;
			}
			
			let minigame = Game.Objects.Farm.minigame;
			
			let now = Date.now();
			let nextStep = Math.min(minigame.nextStep, now + (minigame.stepT)*1000);
			if (now < nextStep)
			{
				// We only care about ticks, exit here
				oldLogic();
				return;
			}
			
			let defaultAging = {};
			let newAge = {};
			
			// This is not ideal, but there's no other practical way to override just the
			// aging without copying over the entire function
			for (let y=0; y<6; y++)
			{
				newAge[y] = [];
				for (let x=0; x<6; x++)
				{
					newAge[y][x] = 0;
					if (!minigame.isTileUnlocked(x,y))
					{
						continue;
					}
					
					let tile = minigame.plot[y][x];
					if (tile[0]<=0)
					{
						continue;
					}
					
					let plant = minigame.plantsById[tile[0]-1];
					defaultAging[plant.id] = defaultAging[plant.id] ?? [plant.ageTick, plant.ageTickR];
					
					let age = defaultAging[plant.id][0];
					let ageRand = defaultAging[plant.id][1];
					
					let rand = Math.max(Math.min(ageRand * Math.random(), ageRand), 0);
					let increase = (age + rand) * minigame.plotBoost[y][x][0];
					tile[1] = Math.max(Math.min(tile[1] + increase, plant.immortal ? plant.mature + 1 : 100), 0);
					
					plant.ageTick = 0;
					plant.ageTickR = 0;
				}
			}
			
			// Run default
			oldLogic();
			
			// Reset plant data
			for (let [k, v] of Object.entries(defaultAging)) {
				let plant = minigame.plantsById[k];
				plant.ageTick = v[0];
				plant.ageTickR = v[1];
			}
			
			minigame.buildPlot();
			
			// Refresh our menus
			CookieGardener.Menu.BuildNextTickList();
			CookieGardener.Menu.BuildAvailabilityList();
		},
		
		Save: function() {
			// Largely copied from minigame
			let M = Game.Objects.Farm.minigame;
			
			//output cannot use ",", ";" or "|"
			var str=''+
			parseFloat(M.nextStep)+':'+
			parseInt(M.soil)+':'+
			parseFloat(M.nextSoil)+':'+
			parseInt(M.freeze)+':'+
			parseInt(M.harvests)+':'+
			parseInt(M.harvestsTotal)+':'+
			parseInt(M.parent.onMinigame?'1':'0')+':'+
			parseFloat(M.convertTimes)+':'+
			parseFloat(M.nextFreeze)+':'+
			' ';
			for (var i in M.plants)
			{
				str+=''+(M.plants[i].unlocked?'1':'0');
			}
			str+=' ';
			for (var y=0;y<6;y++)
			{
				for (var x=0;x<6;x++)
				{
					str+=parseInt(M.plot[y][x][0])+':'+parseFloat(M.plot[y][x][1])+':';
				}
			}
			return str;
		},
		Load: function(str) {
			// Largely copied from minigame
			let M = Game.Objects.Farm.minigame;
			
			//interpret str; called after .init
			//note: not actually called in the Game's load; see "minigameSave" in main.js
			if (!str) return false;
			var i=0;
			var spl=str.split(' ');
			var spl2=spl[i++].split(':');
			var i2=0;
			M.nextStep=parseFloat(spl2[i2++]||M.nextStep);
			M.soil=parseInt(spl2[i2++]||M.soil);
			M.nextSoil=parseFloat(spl2[i2++]||M.nextSoil);
			M.freeze=parseInt(spl2[i2++]||M.freeze)?1:0;
			M.harvests=parseInt(spl2[i2++]||0);
			M.harvestsTotal=parseInt(spl2[i2++]||0);
			var on=parseInt(spl2[i2++]||0);if (on && Game.ascensionMode!=1) M.parent.switchMinigame(1);
			M.convertTimes=parseFloat(spl2[i2++]||M.convertTimes);
			M.nextFreeze=parseFloat(spl2[i2++]||M.nextFreeze);
			var seeds=spl[i++]||'';
			if (seeds)
			{
				var n=0;
				for (var ii in M.plants)
				{
					if (seeds.charAt(n)=='1') M.plants[ii].unlocked=1; else M.plants[ii].unlocked=0;
					n++;
				}
			}
			M.plants['bakerWheat'].unlocked=1;

			var plot=spl[i++]||0;
			if (plot)
			{
				plot=plot.split(':');
				var n=0;
				for (var y=0;y<6;y++)
				{
					for (var x=0;x<6;x++)
					{
						M.plot[y][x]=[parseInt(plot[n]),parseFloat(plot[n+1])];
						n+=2;
					}
				}
			}

			M.getUnlockedN();
			M.computeStepT();

			M.buildPlot();
			M.buildPanel();

			M.computeBoostPlot();
			M.toCompute=true;
		},
	},
}

Game.registerMod("cookieGardener",{
	init:function(){
		CookieGardener.Init();
	},
	save:function(){
		return "";
	},
	load:function(str){
	},
});
