describe('BrowseController', function() {
    // Set up the module
    beforeEach(module('syncthing.folder'));

    var $controller, $scope, $httpBackend;
    var controller, BrowseService, IgnoresService;

    // Inject angular bits
    beforeEach(inject(function($injector) {
        $httpBackend = $injector.get('$httpBackend');
        // Common controller init requests
        // Tests override these responses where necessary

        BrowseService = $injector.get('Browse');
        IgnoresService = $injector.get('Ignores');
        fileMatchesService = $injector.get('FileMatches');
        $controller = $injector.get('$controller');
        $scope = $injector.get('$rootScope');
    }));

    afterEach(function() {
        // Ensure requests are flushed and assertions met
        $httpBackend.verifyNoOutstandingExpectation();
        $httpBackend.verifyNoOutstandingRequest();
    });

    describe('CurrentFolder watch', function() {
        it('does not set Browse reference when current folder is undefined', function() {
            controller = $controller('BrowseController', { $scope: $scope, CurrentFolder: {} });
            $scope.$apply();
            expect(controller.browse).toBeUndefined();
        });

        it('updates browse reference when initialized', function() {
            controller = $controller('BrowseController', { $scope: $scope, CurrentFolder: { id: 'default' } });
            $scope.$apply();
            expect(controller.browse).toBe(BrowseService.forFolder('default'));
        });

        it('updates browse reference when current folder changes', function() {
            var folder = { id: 'default' };
            controller = $controller('BrowseController', { $scope: $scope, CurrentFolder: folder });
            $scope.$apply();
            folder.id = 'documents';
            $scope.$apply();
            expect(controller.browse).toBe(BrowseService.forFolder('documents'));
        });
    });

    describe('toggle', function() {
        var browseHandler;

        beforeEach(function() {
            $httpBackend.when('GET', /^rest\/db\/ignores/).respond({ ignore: [
                '/Photos',
                '!/Music',
            ] });
            browseHandler = $httpBackend.when('GET', /^rest\/db\/browse/).respond({
                Backups: {},
                Music: {},
                Photos: {},
            });
            BrowseService.refresh('default');
            compute();
        });

        function compute() {
            IgnoresService.refresh('default');
            controller = $controller('BrowseController', { $scope: $scope, CurrentFolder: { id: 'default' } });
            $httpBackend.flush();
            fileMatchesService.update(
                'default',
                BrowseService.forFolder('default').files,
                IgnoresService.forFolder('default').patterns,
            );
        }

        function matchFile(name) {
            var match = fileMatchesService.forFolder('default').find(function(fm) { return fm.file.name === name; })
            if (!match) {
                throw 'No file match with name "' + name + '"';
            }
            return match;
        }

        it('removes a pattern for an ignored file', function() {
            expect(matchFile('Photos').match).toBeDefined();
            controller.toggle(matchFile('Photos'));
            expect(matchFile('Photos').match).toBeUndefined();
        });

        it('removes a pattern for an included file', function() {
            expect(matchFile('Music').match).toBeDefined();
            controller.toggle(matchFile('Music'));
            expect(matchFile('Music').match).toBeUndefined();
        });

        it('adds a pattern for a file', function() {
            expect(matchFile('Backups').match).toBeUndefined();
            controller.toggle(matchFile('Backups'));
            expect(matchFile('Backups').match).toBeDefined();
        });

        describe('child of ignored directory', function() {
            beforeEach(function() {
                browseHandler.respond({
                    Raw: {},
                });
                BrowseService.refresh('default', 'Photos');
                compute();
            });

            it('adds a pattern to include file', function() {
                expect(matchFile('Raw').match).toBeDefined();
                controller.toggle(matchFile('Raw'));
                expect(matchFile('Raw').match).toBeDefined();
                expect(matchFile('Raw').match.isNegated).toBeTrue();
            });
        });

        describe('child of included directory', function() {
            beforeEach(function() {
                browseHandler.respond({
                    Phish: {},
                });
                BrowseService.refresh('default', 'Music');
                compute();
            });

            it('adds a pattern to ignore file', function() {
                expect(matchFile('Phish').match).toBeDefined();
                controller.toggle(matchFile('Phish'));
                expect(matchFile('Phish').match).toBeDefined();
                expect(matchFile('Phish').match.isNegated).toBeFalse();
            });
        });
    });

    describe('navigate', function() {
        it('fetches the given folder and prefix', function() {
            $httpBackend.expectGET('rest/db/browse?folder=chocolate&levels=0&prefix=factory%2Fsecrets').respond({});
            controller = $controller('BrowseController', { $scope: $scope, CurrentFolder: { id: 'default' } });
            controller.navigate('chocolate', 'factory/secrets');
            $httpBackend.flush();
        });
    });
});
